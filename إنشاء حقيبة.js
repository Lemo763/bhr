const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const config = require("../config");

const AUTO_DELETE_MS = 15_000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("إنشاء-حقيبة")
        .setDescription("أرسل رسالة إنشاء الحقيبة (للأدمن فقط)"),

    async execute(interaction) {
        // التحقق من رتبة الأدمن
        if (!interaction.member.roles.cache.has(config.adminRole)) {
            const msg = await interaction.reply({
                content: "❌ ما عندك صلاحية لاستخدام هذا الأمر.",
                fetchReply: true
            });
            setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_MS);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(config.embed.color)
            .setTitle("🎒 نظام الحقيبة")
            .setDescription(
                "اضغط على الزر أدناه لإنشاء حقيبتك الخاصة.\n\n" +
                "سيتم إنشاء غرفة خاصة بك تحتوي على مواردك ورصيدك."
            )
            .setFooter({ text: `© ${config.embed.footer} | 2026` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("create_bag")
                .setLabel("إنشاء حقيبة")
                .setStyle(ButtonStyle.Success)
                .setEmoji("🎒")
        );

        // رسالة تأكيد للأدمن — تنحذف تلقائياً
        const confirmMsg = await interaction.reply({ content: "✅ تم إرسال الرسالة.", fetchReply: true });
        setTimeout(() => { confirmMsg.delete().catch(() => {}); }, AUTO_DELETE_MS);

        // الرسالة الدائمة بزر إنشاء الحقيبة — لا تُحذف
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};