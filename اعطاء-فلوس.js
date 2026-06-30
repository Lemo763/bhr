const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const config = require("../config");

const AUTO_DELETE_MS = 15_000;

function readDB() {
    if (fs.existsSync("./inventory.json"))
        return JSON.parse(fs.readFileSync("./inventory.json", "utf8"));
    return {};
}

function saveDB(db) {
    fs.writeFileSync("./inventory.json", JSON.stringify(db, null, 4));
}

function ensureUser(db, userId) {
    if (!db[userId]) db[userId] = { items: {}, balance: 0 };
    if (db[userId].balance === undefined) db[userId].balance = 0;
    return db;
}

function autoDelete(msg) {
    setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("اعطاء-فلوس")
        .setDescription("حوّل فلوس لشخص آخر")
        .addUserOption(opt =>
            opt.setName("الشخص")
                .setDescription("المستخدم المراد التحويل إليه")
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName("المبلغ")
                .setDescription("المبلغ المراد تحويله")
                .setMinValue(1)
                .setRequired(true)
        ),

    async execute(interaction) {
        const senderId = interaction.user.id;
        const target   = interaction.options.getUser("الشخص");
        const amount   = interaction.options.getInteger("المبلغ");

        if (target.bot) {
            const msg = await interaction.reply({ content: "❌ لا تقدر تحوّل فلوس لبوت.", fetchReply: true });
            return autoDelete(msg);
        }

        if (target.id === senderId) {
            const msg = await interaction.reply({ content: "❌ ما تقدر تحوّل فلوس لنفسك.", fetchReply: true });
            return autoDelete(msg);
        }

        let db = readDB();
        db = ensureUser(db, senderId);
        db = ensureUser(db, target.id);

        if (db[senderId].balance < amount) {
            const msg = await interaction.reply({
                content: `❌ رصيدك غير كافٍ. عندك **${db[senderId].balance} فلوس** فقط.`,
                fetchReply: true
            });
            return autoDelete(msg);
        }

        db[senderId].balance  -= amount;
        db[target.id].balance += amount;
        saveDB(db);

        const embed = new EmbedBuilder()
            .setColor(config.embed.color)
            .setTitle("💸 تحويل فلوس")
            .setDescription(
                `✅ تم تحويل **${amount} 💰 فلوس** إلى ${target}.\n\n` +
                `💳 رصيدك الجديد: **${db[senderId].balance} فلوس**`
            )
            .setFooter({ text: `© ${config.embed.footer} | 2026` });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        autoDelete(msg);
    }
};