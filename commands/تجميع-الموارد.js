const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const config = require("../config");

const cooldowns = new Map();
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
    if (!db[userId].items) db[userId].items = {};
    if (db[userId].balance === undefined) db[userId].balance = 0;
    for (const item of config.items) {
        if (db[userId].items[item.name] === undefined)
            db[userId].items[item.name] = 0;
    }
    return db;
}

// يرسل رسالة وتنحذف تلقائياً بعد المدة المحددة
async function sendAutoDelete(interaction, content) {
    const msg = await interaction.followUp({ content });
    setTimeout(() => {
        msg.delete().catch(() => {});
    }, AUTO_DELETE_MS);
    return msg;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("تجميع-الموارد")
        .setDescription("ابدأ بتجميع الموارد"),

    async execute(interaction) {
        const userId = interaction.user.id;

        // كولداون
        if (cooldowns.has(userId)) {
            const expire = cooldowns.get(userId);
            if (Date.now() < expire) {
                const left = Math.ceil((expire - Date.now()) / 1000);
                return interaction.reply({
                    content: `⏳ انتظر **${left}** ثانية قبل أن تجمع مرة أخرى.`,
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, Date.now() + config.cooldown * 1000);

        // اختيار سؤال عشوائي
        const random = config.questions[Math.floor(Math.random() * config.questions.length)];

        const embed = new EmbedBuilder()
            .setColor(config.embed.color)
            .setTitle("🧠 تجميع الموارد")
            .setDescription(
                `أجب على السؤال خلال **${config.questionTime}** ثوانٍ.\n\n` +
                `**${random.question} = ؟**`
            )
            .setFooter({ text: `© ${config.embed.footer} | 2026` });

        const questionMsg = await interaction.reply({ embeds: [embed], fetchReply: true });

        // حذف رسالة السؤال نفسها بعد المدة المحددة أيضاً
        setTimeout(() => {
            questionMsg.delete().catch(() => {});
        }, AUTO_DELETE_MS);

        const collector = interaction.channel.createMessageCollector({
            filter: m => m.author.id === userId,
            max: 1,
            time: config.questionTime * 1000
        });

        collector.on("collect", async message => {
            // حذف رسالة إجابة المستخدم نفسها بعد المدة
            setTimeout(() => {
                message.delete().catch(() => {});
            }, AUTO_DELETE_MS);

            if (message.content.trim() !== random.answer) {
                collector.stop("wrong");
                return sendAutoDelete(interaction, "❌ إجابة خاطئة.");
            }

            let db = readDB();
            db = ensureUser(db, userId);

            let result = "✅ **تم جمع الموارد:**\n\n";

            // يجيب مورد عشوائي واحد من القائمة
            const randomItem = config.items[Math.floor(Math.random() * config.items.length)];
            db[userId].items[randomItem.name] += randomItem.reward;
            result += `${randomItem.emoji} **${randomItem.name}**: +${randomItem.reward}\n`;

            saveDB(db);
            collector.stop("success");

            await sendAutoDelete(interaction, result);
        });

        collector.on("end", (collected, reason) => {
            if (reason === "time") {
                sendAutoDelete(interaction, "⌛ انتهى الوقت ولم تحصل على أي موارد.");
            }
        });
    }
};