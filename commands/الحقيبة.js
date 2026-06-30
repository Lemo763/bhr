const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const config = require("../config");
const { buildBagEmbed, buildBagButtons, ensureUser, readDB, saveDB } = require("./bag-handler");

const CATEGORY_ID = "1521486129881419916";
const AUTO_DELETE_MS = 15_000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("الحقيبة")
        .setDescription("اذهب إلى حقيبتك الخاصة"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guild  = interaction.guild;

        const existing = guild.channels.cache.find(
            c => c.parentId === CATEGORY_ID && c.topic === `BAG_OWNER:${userId}`
        );

        if (existing) {
            // لو الشخص كاتب الأمر داخل روم حقيبته نفسه، تفتح له الحقيبة مباشرة (لا تُحذف)
            if (interaction.channel.id === existing.id) {
                let db = readDB();
                db = ensureUser(db, userId);
                saveDB(db);

                return interaction.reply({
                    embeds: [buildBagEmbed(userId, db)],
                    components: [buildBagButtons()]
                });
            }

            const msg = await interaction.reply({
                content: `📦 حقيبتك هنا: ${existing}`,
                fetchReply: true
            });
            setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#E74C3C")
            .setTitle("❌ لا تملك حقيبة")
            .setDescription("يجب عليك إنشاء حقيبة أولاً قبل استخدام هذا الأمر.")
            .setFooter({ text: `© ${config.embed.footer} | 2026` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("create_bag")
                .setLabel("إنشاء حقيبة")
                .setStyle(ButtonStyle.Success)
                .setEmoji("🎒")
        );

        const msg = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });
        setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
    }
};