require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    Routes
} = require("discord.js");

const config = require("./config");
const { handleCreateBag, handleBagButtonInteraction, CATEGORY_ID } = require("./    bag-handler");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// تحميل الأوامر (ماعدا bag-handler لأنها handler مو أمر)
const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js") && file !== "bag-handler.js");

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

// تسجيل الأوامر
const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
    try {
        console.log("جارٍ تسجيل الأوامر...");
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        console.log("تم تسجيل جميع الأوامر.");
    } catch (err) {
        console.error(err);
    }
})();

// جاهزية البوت
client.once("clientReady", () => {
    console.log(`تم تسجيل الدخول باسم ${client.user.tag}`);
    client.user.setPresence({ status: "online" });
});

const BAG_BUTTON_IDS = ["show_inv", "give_item", "sell_items", "shop"];

// استقبال الأوامر والأزرار
client.on("interactionCreate", async interaction => {

    // زر إنشاء الحقيبة
    if (interaction.isButton() && interaction.customId === "create_bag") {
        return handleCreateBag(interaction);
    }

    // أزرار الحقيبة (عرض / إعطاء / بيع / متجر)
    if (interaction.isButton() && BAG_BUTTON_IDS.includes(interaction.customId)) {
        // تحقق إن الروم هو حقيبة الشخص نفسه
        if (
            interaction.channel.parentId !== CATEGORY_ID ||
            interaction.channel.topic !== `BAG_OWNER:${interaction.user.id}`
        ) {
            return interaction.reply({
                content: "❌ هذي ليست حقيبتك.",
                ephemeral: true
            });
        }

        try {
            await handleBagButtonInteraction(interaction);
        } catch (err) {
            console.error(err);
        }
        return;
    }

    if (interaction.isButton()) return;

    // أوامر
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        if (interaction.replied || interaction.deferred) {
            interaction.followUp({ content: "حدث خطأ أثناء تنفيذ الأمر.", ephemeral: true });
        } else {
            interaction.reply({ content: "حدث خطأ أثناء تنفيذ الأمر.", ephemeral: true });
        }
    }
});

client.login(config.token);