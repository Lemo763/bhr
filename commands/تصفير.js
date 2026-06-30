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

function autoDelete(msg) {
    setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("تصفير")
        .setDescription("تصفير مخزون لاعب (للأدمن فقط)")
        .addUserOption(opt =>
            opt.setName("اللاعب")
                .setDescription("اللاعب المراد تصفير مخزونه")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("النوع")
                .setDescription("ماذا تريد تصفيره؟")
                .setRequired(true)
                .addChoices(
                    { name: "المخزون فقط",        value: "items"   },
                    { name: "الرصيد فقط",          value: "balance" },
                    { name: "المخزون والرصيد معاً", value: "all"     }
                )
        ),

    async execute(interaction) {
        const member = interaction.member;
        const hasRole = member.roles.cache.has(config.adminRole);

        if (!hasRole) {
            const msg = await interaction.reply({
                content: "❌ ما عندك صلاحية لاستخدام هذا الأمر.",
                fetchReply: true
            });
            return autoDelete(msg);
        }

        const target = interaction.options.getUser("اللاعب");
        const type   = interaction.options.getString("النوع");

        if (target.bot) {
            const msg = await interaction.reply({
                content: "❌ لا تقدر تصفّر مخزون بوت.",
                fetchReply: true
            });
            return autoDelete(msg);
        }

        let db = readDB();

        if (!db[target.id]) {
            const msg = await interaction.reply({
                content: `❌ اللاعب ${target} ما عنده سجل في قاعدة البيانات.`,
                fetchReply: true
            });
            return autoDelete(msg);
        }

        let desc = "";

        if (type === "items" || type === "all") {
            for (const item of config.items) {
                db[target.id].items[item.name] = 0;
            }
            desc += "🔩 تم تصفير **المخزون**\n";
        }

        if (type === "balance" || type === "all") {
            db[target.id].balance = 0;
            desc += "💰 تم تصفير **الرصيد**\n";
        }

        saveDB(db);

        const embed = new EmbedBuilder()
            .setColor("#E74C3C")
            .setTitle("🗑️ تصفير")
            .setDescription(`${desc}\nاللاعب: ${target}`)
            .setFooter({ text: `نفّذ بواسطة: ${interaction.user.tag} | © ${config.embed.footer} | 2026` });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        autoDelete(msg);
    }
};