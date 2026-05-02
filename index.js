const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

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

// format số đẹp
function format(num) {
  return num.toLocaleString("vi-VN");
}

client.on('ready', () => {
  console.log(`✅ Bot đã online: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);

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
      return message.reply("❌ Sai format!\nDùng: !report acc troop food wood stone gold");
    }

    if (!data[user]) data[user] = {};
    data[user][acc] = { troop, food, wood, stone, gold };

    saveData();

    const embed = new EmbedBuilder()
      .setTitle("✅ Báo cáo thành công")
      .setDescription(`Acc: **${acc}**`)
      .addFields(
        { name: "👤 Người gửi", value: user, inline: true },
        { name: "⚔️ Quân", value: format(troop), inline: true },
        { name: "🍖 Food", value: format(food), inline: true },
        { name: "🌲 Wood", value: format(wood), inline: true },
        { name: "🪨 Stone", value: format(stone), inline: true },
        { name: "🪙 Gold", value: format(gold), inline: true }
      )
      .setColor("Green");

    message.reply({ embeds: [embed] });
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

    const embed = new EmbedBuilder()
      .setTitle("📊 Tổng thống kê")
      .addFields(
        { name: "⚔️ Tổng quân", value: format(totalTroop), inline: true },
        { name: "📦 Tổng tài nguyên", value: format(totalRes), inline: true }
      )
      .setColor("Blue");

    message.reply({ embeds: [embed] });
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

    let desc = "";
    list.slice(0, 10).forEach((x, i) => {
      desc += `**${i + 1}.** ${x.name} - ${format(x.troop)}\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 BXH Quân Đội")
      .setDescription(desc || "Chưa có dữ liệu")
      .setColor("Gold");

    message.reply({ embeds: [embed] });
  }

  // ===== CHECK =====
  if (args[0] === "!check") {
    const minTroop = parseInt(args[1]);

    if (isNaN(minTroop)) {
      return message.reply("❌ Dùng: !check số_quân_tối_thiểu");
    }

    let thiếu = [];

    for (let user in data) {
      for (let acc in data[user]) {
        let t = data[user][acc].troop;
        if (t < minTroop) {
          thiếu.push(`${user} (${acc}) - ${format(t)}`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Danh sách chưa đạt")
      .setDescription(thiếu.length ? thiếu.join("\n") : "✅ Tất cả đạt yêu cầu")
      .setColor("Red");

    message.reply({ embeds: [embed] });
  }

});

// dùng biến môi trường (Railway)
client.login(process.env.TOKEN);
