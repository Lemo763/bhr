const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const config = require("../config");
const { ensureUser, readDB, saveDB } = require("./bag-handler");

const AUTO_DELETE_MS = 15_000;

// =============================================
// أغراض خاصة لا تظهر في المتجر، تُعطى عبر هذا الأمر فقط
// =============================================
const SPECIAL_ITEMS = [
    { name: "تيزر", emoji: "🔫" }
];

function autoDelete(msg) {
    setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
}

function getAllGivableItems() {
    // الموارد + أغراض المتجر + الأغراض الخاصة، كلهم بقائمة واحدة موحدة
    return [
        ...config.items.map(i => ({ name: i.name, emoji: i.emoji, type: "items" })),
        ...config.shop.map(i => ({ name: i.name, emoji: i.emoji, type: "shopItems" })),
        ...SPECIAL_ITEMS.map(i => ({ name: i.name, emoji: i.emoji, type: "shopItems" }))
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-item")
        .setDescription("إعطاء غرض لشخص معيّن (للأدمن فقط)")
        .addUserOption(opt =>
            opt.setName("الشخص")
                .setDescription("الشخص المراد إعطاؤه الغرض")
                .setRequired(true)
        )
        .addStringOption(opt => {
            opt.setName("الغرض")
                .setDescription("اسم الغرض")
                .setRequired(true);
            const allItems = getAllGivableItems();
            // الحد الأقصى لخيارات السلاش 25
            allItems.slice(0, 25).forEach(item => {
                opt.addChoices({ name: item.name, value: item.name });
            });
            return opt;
        })
        .addIntegerOption(opt =>
            opt.setName("الكمية")
                .setDescription("الكمية المراد إعطاؤها")
                .setMinValue(1)
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

        const target    = interaction.options.getUser("الشخص");
        const itemName  = interaction.options.getString("الغرض");
        const amount    = interaction.options.getInteger("الكمية");

        if (target.bot) {
            const msg = await interaction.reply({ content: "❌ لا تقدر تعطي بوت أغراض.", fetchReply: true });
            return autoDelete(msg);
        }

        const allItems = getAllGivableItems();
        const validItem = allItems.find(x => x.name === itemName);

        if (!validItem) {
            const msg = await interaction.reply({ content: `❌ الغرض **${itemName}** غير موجود.`, fetchReply: true });
            return autoDelete(msg);
        }

        let db = readDB();
        db = ensureUser(db, target.id);

        if (validItem.type === "items") {
            db[target.id].items[itemName] = (db[target.id].items[itemName] ?? 0) + amount;
        } else {
            if (!db[target.id].shopItems) db[target.id].shopItems = {};
            db[target.id].shopItems[itemName] = (db[target.id].shopItems[itemName] ?? 0) + amount;
        }

        saveDB(db);

        const embed = new EmbedBuilder()
            .setColor(config.embed.color)
            .setTitle("🎁 إعطاء غرض")
            .setDescription(
                `✅ تم إعطاء **${amount}x ${validItem.emoji} ${itemName}** للمستخدم ${target}.`
            )
            .setFooter({ text: `نفّذ بواسطة: ${interaction.user.tag} | © ${config.embed.footer} | 2026` });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        autoDelete(msg);
    }
};