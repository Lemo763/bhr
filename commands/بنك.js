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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("بنك")
        .setDescription("اعرض رصيدك من الفلوس"),

    async execute(interaction) {
        const userId = interaction.user.id;
        let db = readDB();
        db = ensureUser(db, userId);
        saveDB(db);

        const balance = db[userId].balance;

        const embed = new EmbedBuilder()
            .setColor(config.embed.color)
            .setTitle("🏦 البنك")
            .setDescription(`💰 رصيدك الحالي: **${balance} فلوس**`)
            .setFooter({ text: `© ${config.embed.footer} | 2026` });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
    }
};