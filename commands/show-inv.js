const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const config = require("../config");
const { ensureUser, readDB } = require("./bag-handler");

const AUTO_DELETE_MS = 15_000;

function autoDelete(msg) {
    setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("show-inv")
        .setDescription("عرض حقيبة شخص معيّن (للأدمن فقط)")
        .addUserOption(opt =>
            opt.setName("الشخص")
                .setDescription("الشخص المراد عرض حقيبته")
                .setRequired(true)
        ),

    async execute(interaction) {
        // التحقق من رتبة الأدمن
        if (!interaction.member.roles.cache.has(config.adminRole)) {
            const msg = await interaction.reply({
                content: "❌ ما عندك صلاحية لاستخدام هذا الأمر.",
                fetchReply: true
            });
            return autoDelete(msg);
        }

        const target = interaction.options.getUser("الشخص");

        if (target.bot) {
            const msg = await interaction.reply({ content: "❌ البوتات ما عندها حقيبة.", fetchReply: true });
            return autoDelete(msg);
        }

        let db = readDB();
        db = ensureUser(db, target.id);

        let resourcesText = "";
        for (const item of config.items) {
            const amt = db[target.id].items[item.name] ?? 0;
            resourcesText += `${item.emoji} **${item.name}** : ${amt}\n`;
        }

        let shopText = "";
        for (const item of (db[target.id].shopItems ? Object.keys(db[target.id].shopItems) : [])) {
            const amt = db[target.id].shopItems[item] ?? 0;
            if (amt > 0) {
                // البحث عن الإيموجي من config.shop أو من الأغراض الخاصة، وإلا نستخدم رمز افتراضي
                const found = config.shop.find(x => x.name === item);
                const emoji = found ? found.emoji : "🎯";
                shopText += `${emoji} **${item}** : ${amt}\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(config.embed.color)
            .setTitle(`🎒 حقيبة ${target.username}`)
            .setDescription(
                `**📦 الموارد:**\n${resourcesText}\n` +
                (shopText ? `**🛒 المشتريات:**\n${shopText}\n` : "") +
                `\n💰 **الرصيد** : ${db[target.id].balance ?? 0} فلوس`
            )
            .setFooter({ text: `طلبها: ${interaction.user.tag} | © ${config.embed.footer} | 2026` });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        autoDelete(msg);
    }
};