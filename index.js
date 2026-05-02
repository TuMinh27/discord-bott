const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let data = {};
if (fs.existsSync('data.json')) {
  data = JSON.parse(fs.readFileSync('data.json'));
}

function saveData() {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

function format(num) {
  return num.toLocaleString("vi-VN");
}

client.on('ready', () => {
  console.log(`✅ Bot đã online: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);

  // ===== OCR IMAGE =====
  if (message.attachments.size > 0) {
    try {
      const file = message.attachments.first();

      const res = await axios.get(file.url, { responseType: 'arraybuffer' });
      fs.writeFileSync('input.png', res.data);

      // ===== CẮT ẢNH QUÂN =====
      await cropTroopImage('input.png', 'troop.png');
      let text = await readNumbers('troop.png');
      let troops = extractTroops(text);

      let resources = null;

      // ===== NẾU KHÔNG PHẢI QUÂN → ĐỌC TÀI NGUYÊN =====
      if (!troops) {
        await cropResourceImage('input.png', 'res.png');
        text = await readNumbers('res.png');
        resources = extractResources(text);
      }

      const embed = new EmbedBuilder()
        .setTitle("📊 Kết quả đọc ảnh")
        .addFields(
          { name: "⚔️ Bộ", value: format(troops?.infantry || 0), inline: true },
          { name: "🐎 Kỵ", value: format(troops?.cavalry || 0), inline: true },
          { name: "🏹 Cung", value: format(troops?.archer || 0), inline: true },
          { name: "💣 Công thành", value: format(troops?.siege || 0), inline: true },
          { name: "🌾 Food", value: format(resources?.food || 0), inline: true },
          { name: "🌲 Wood", value: format(resources?.wood || 0), inline: true },
          { name: "🪨 Stone", value: format(resources?.stone || 0), inline: true },
          { name: "🪙 Gold", value: format(resources?.gold || 0), inline: true }
        )
        .setColor("Green");

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      return message.reply("❌ Lỗi đọc ảnh");
    }
  }

  // ===== REPORT =====
  if (args[0] === "!report") {
    const user = message.author.username;
    const acc = args[1];

    const troop = parseInt(args[2]);
    const food = parseInt(args[3]);
    const wood = parseInt(args[4]);
    const stone = parseInt(args[5]);
    const gold = parseInt(args[6]);

    if (!acc || isNaN(troop)) {
      return message.reply("❌ Sai format!\n!report acc troop food wood stone gold");
    }

    if (!data[user]) data[user] = {};
    data[user][acc] = { troop, food, wood, stone, gold };

    saveData();

    return message.reply("✅ Đã lưu dữ liệu");
  }

  // ===== TOTAL =====
  if (args[0] === "!total") {
    let totalTroop = 0;
    let totalRes = 0;

    for (let user in data) {
      for (let acc in data[user]) {
        let d = data[user][acc];
        totalTroop += d.troop;
        totalRes += d.food + d.wood + d.stone + d.gold;
      }
    }

    return message.reply(`📊 Tổng quân: ${format(totalTroop)}\n📦 Tổng tài nguyên: ${format(totalRes)}`);
  }

  // ===== TOP =====
  if (args[0] === "!top") {
    let list = [];

    for (let user in data) {
      for (let acc in data[user]) {
        list.push({
          name: `${user} (${acc})`,
          troop: data[user][acc].troop
        });
      }
    }

    list.sort((a, b) => b.troop - a.troop);

    let msg = "🏆 BXH quân:\n";
    list.slice(0, 10).forEach((x, i) => {
      msg += `${i + 1}. ${x.name}: ${format(x.troop)}\n`;
    });

    return message.reply(msg);
  }

  // ===== CHECK =====
  if (args[0] === "!check") {
    const minTroop = parseInt(args[1]);

    if (isNaN(minTroop)) {
      return message.reply("❌ !check số_quân");
    }

    let thiếu = [];

    for (let user in data) {
      for (let acc in data[user]) {
        if (data[user][acc].troop < minTroop) {
          thiếu.push(`${user} (${acc})`);
        }
      }
    }

    return message.reply(
      thiếu.length ? `⚠️ Chưa đạt:\n${thiếu.join("\n")}` : "✅ Tất cả đạt"
    );
  }
});

// ===== IMAGE PROCESS =====
async function cropTroopImage(input, output) {
  const img = sharp(input);
  const meta = await img.metadata();

  await img.extract({
    left: Math.floor(meta.width * 0.15),
    top: Math.floor(meta.height * 0.45),
    width: Math.floor(meta.width * 0.7),
    height: Math.floor(meta.height * 0.25)
  }).grayscale().normalize().sharpen().toFile(output);
}

async function cropResourceImage(input, output) {
  const img = sharp(input);
  const meta = await img.metadata();

  await img.extract({
    left: Math.floor(meta.width * 0.55),
    top: Math.floor(meta.height * 0.25),
    width: Math.floor(meta.width * 0.35),
    height: Math.floor(meta.height * 0.5)
  }).grayscale().normalize().sharpen().toFile(output);
}

async function readNumbers(path) {
  const result = await Tesseract.recognize(path, 'eng', {
    tessedit_char_whitelist: '0123456789.MB'
  });
  return result.data.text;
}

function cleanNumber(str) {
  if (!str) return 0;

  str = str.replace(/[^0-9.MB]/g, "");

  if (str.includes("B")) return parseFloat(str) * 1e9;
  if (str.includes("M")) return parseFloat(str) * 1e6;

  return parseInt(str);
}

function extractTroops(text) {
  const nums = text.match(/[\d.]+/g);
  if (!nums || nums.length < 4) return null;

  return {
    infantry: cleanNumber(nums[0]),
    cavalry: cleanNumber(nums[1]),
    archer: cleanNumber(nums[2]),
    siege: cleanNumber(nums[3])
  };
}

function extractResources(text) {
  const nums = text.match(/[\d.]+[MB]?/g);
  if (!nums || nums.length < 4) return null;

  return {
    food: cleanNumber(nums[0]),
    wood: cleanNumber(nums[1]),
    stone: cleanNumber(nums[2]),
    gold: cleanNumber(nums[3])
  };
}

client.login(process.env.TOKEN);
