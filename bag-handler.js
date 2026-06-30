const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require("discord.js");

const fs = require("fs");
const config = require("../config");

const CATEGORY_ID = "1521486129881419916";

// يحوّل صيغة <:name:id> إلى كائن { id, name } المطلوب لـ setEmoji، ويترك الإيموجي العادي كما هو
function parseEmoji(raw) {
    const match = /^<a?:(\w+):(\d+)>$/.exec(raw);
    if (match) {
        return { name: match[1], id: match[2] };
    }
    return raw;
}

function readDB() {
    if (fs.existsSync("./inventory.json"))
        return JSON.parse(fs.readFileSync("./inventory.json", "utf8"));
    return {};
}

function saveDB(db) {
    fs.writeFileSync("./inventory.json", JSON.stringify(db, null, 4));
}

function ensureUser(db, userId) {
    if (!db[userId]) db[userId] = { items: {}, shopItems: {}, balance: 0 };
    if (!db[userId].items) db[userId].items = {};
    if (!db[userId].shopItems) db[userId].shopItems = {};
    if (db[userId].balance === undefined) db[userId].balance = 0;
    for (const item of config.items) {
        if (db[userId].items[item.name] === undefined)
            db[userId].items[item.name] = 0;
    }
    for (const item of config.shop) {
        if (db[userId].shopItems[item.name] === undefined)
            db[userId].shopItems[item.name] = 0;
    }
    return db;
}

function buildBagEmbed(userId, db) {
    let resourcesText = "";
    for (const item of config.items) {
        const amt = db[userId].items[item.name] ?? 0;
        resourcesText += `${item.emoji} **${item.name}** : ${amt}\n`;
    }

    let shopText = "";
    for (const itemName of Object.keys(db[userId].shopItems || {})) {
        const amt = db[userId].shopItems[itemName] ?? 0;
        if (amt > 0) {
            const found = config.shop.find(x => x.name === itemName);
            const emoji = found ? found.emoji : "🎯";
            shopText += `${emoji} **${itemName}** : ${amt}\n`;
        }
    }

    return new EmbedBuilder()
        .setColor(config.embed.color)
        .setTitle("🎒 الحقيبة")
        .setDescription(
            `**📦 الموارد:**\n${resourcesText}\n` +
            (shopText ? `**🛒 المشتريات:**\n${shopText}\n` : "") +
            `\n💰 **الرصيد** : ${db[userId].balance ?? 0} فلوس`
        )
        .setFooter({ text: `© ${config.embed.footer} | 2026` });
}

function buildShopEmbed() {
    let text = "";
    for (const item of config.shop) {
        text += `${item.emoji} **${item.name}** — ${item.cost} 💰 فلوس\n`;
    }
    return new EmbedBuilder()
        .setColor("#3498DB")
        .setTitle("🛒 المتجر")
        .setDescription(text)
        .setFooter({ text: `© ${config.embed.footer} | 2026` });
}

function buildBagButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("show_inv")
            .setLabel("عرض الحقيبة")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId("give_item")
            .setLabel("إعطاء مورد")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId("sell_items")
            .setLabel("بيع الموارد")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId("shop")
            .setLabel("المتجر 🛒")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

// ── معالج موحّد لجميع أزرار الحقيبة، يشتغل على أي رسالة حقيبة (سواء التلقائية أو عبر /الحقيبة) ──
async function handleBagButtonInteraction(i) {
    const userId  = i.user.id;
    const channel = i.channel;

    if (i.user.id !== i.message.interaction?.user?.id && i.message.mentions?.users?.size === 0) {
        // لا داعي للتحقق هنا، الفلترة تتم في index.js عبر مقارنة صاحب الرسالة
    }

    if (i.customId === "show_inv") {
        await i.deferUpdate();
        let db = readDB();
        db = ensureUser(db, userId);
        await i.message.edit({ embeds: [buildBagEmbed(userId, db)], components: [buildBagButtons()] });

    } else if (i.customId === "give_item") {
        const modal = new ModalBuilder()
            .setCustomId("modal_give")
            .setTitle("إعطاء مورد");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("give_userid")
                    .setLabel("ID الشخص")
                    .setPlaceholder("مثال: 123456789012345678")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("give_item_name")
                    .setLabel("اسم المورد")
                    .setPlaceholder("مثال: ألمنيوم")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("give_amount")
                    .setLabel("الكمية")
                    .setPlaceholder("مثال: 5")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );

        await i.showModal(modal);
        const submitted = await i.awaitModalSubmit({ time: 60_000 }).catch(() => null);
        if (!submitted) return;

        const targetId = submitted.fields.getTextInputValue("give_userid").trim();
        const itemName = submitted.fields.getTextInputValue("give_item_name").trim();
        const amount   = parseInt(submitted.fields.getTextInputValue("give_amount"));

        const validItem = config.items.find(x => x.name === itemName);
        if (!validItem)
            return submitted.reply({ content: `❌ المورد **${itemName}** غير موجود.`, ephemeral: true });
        if (isNaN(amount) || amount <= 0)
            return submitted.reply({ content: "❌ الكمية يجب أن تكون رقم أكبر من 0.", ephemeral: true });

        let db = readDB();
        db = ensureUser(db, userId);
        db = ensureUser(db, targetId);

        if ((db[userId].items[itemName] ?? 0) < amount)
            return submitted.reply({ content: `❌ ما عندك كمية كافية من **${itemName}**.`, ephemeral: true });

        db[userId].items[itemName]  -= amount;
        db[targetId].items[itemName] = (db[targetId].items[itemName] ?? 0) + amount;
        saveDB(db);

        await submitted.reply({
            content: `✅ تم إعطاء **${amount}x ${validItem.emoji} ${itemName}** للمستخدم <@${targetId}>.`,
            ephemeral: true
        });
        await i.message.edit({ embeds: [buildBagEmbed(userId, db)] });

    } else if (i.customId === "sell_items") {
        const modal = new ModalBuilder()
            .setCustomId("modal_sell")
            .setTitle("بيع الموارد");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("sell_item_name")
                    .setLabel("اسم المورد")
                    .setPlaceholder("مثال: ألمنيوم")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("sell_amount")
                    .setLabel("الكمية")
                    .setPlaceholder("مثال: 5")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );

        await i.showModal(modal);
        const submitted = await i.awaitModalSubmit({ time: 60_000 }).catch(() => null);
        if (!submitted) return;

        const itemName = submitted.fields.getTextInputValue("sell_item_name").trim();
        const amount   = parseInt(submitted.fields.getTextInputValue("sell_amount"));

        const validItem = config.items.find(x => x.name === itemName);
        if (!validItem)
            return submitted.reply({ content: `❌ المورد **${itemName}** غير موجود.`, ephemeral: true });
        if (isNaN(amount) || amount <= 0)
            return submitted.reply({ content: "❌ الكمية يجب أن تكون رقم أكبر من 0.", ephemeral: true });

        let db = readDB();
        db = ensureUser(db, userId);

        if ((db[userId].items[itemName] ?? 0) < amount)
            return submitted.reply({ content: `❌ ما عندك كمية كافية من **${itemName}**.`, ephemeral: true });

        const earned = validItem.price * amount;
        db[userId].items[itemName] -= amount;
        db[userId].balance         += earned;
        saveDB(db);

        await submitted.reply({
            content: `✅ بعت **${amount}x ${validItem.emoji} ${itemName}** بـ **${earned} 💰 فلوس**.`,
            ephemeral: true
        });
        await i.message.edit({ embeds: [buildBagEmbed(userId, db)] });

    } else if (i.customId === "shop") {
        await i.deferUpdate();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("shop_select")
            .setPlaceholder("اختر غرضاً للشراء...")
            .addOptions(
                config.shop.map(item =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${item.name} — ${item.cost} فلوس`)
                        .setValue(item.name)
                        .setEmoji(parseEmoji(item.emoji))
                )
            );

        const shopMsg = await channel.send({
            embeds: [buildShopEmbed()],
            components: [new ActionRowBuilder().addComponents(selectMenu)]
        });

        const shopCollector = channel.createMessageComponentCollector({
            filter: s => s.user.id === userId && s.customId === "shop_select",
            time: 30_000,
            max: 1
        });

        shopCollector.on("collect", async s => {
            await s.deferUpdate();
            const itemName  = s.values[0];
            const shopItem  = config.shop.find(x => x.name === itemName);

            let db = readDB();
            db = ensureUser(db, userId);

            if (db[userId].balance < shopItem.cost) {
                await channel.send({
                    content: `❌ ما عندك رصيد كافٍ. تحتاج **${shopItem.cost} 💰 فلوس** وعندك **${db[userId].balance} 💰 فلوس**.`
                });
            } else {
                db[userId].balance -= shopItem.cost;
                db[userId].shopItems[shopItem.name] = (db[userId].shopItems[shopItem.name] ?? 0) + 1;
                saveDB(db);

                await channel.send({
                    content: `✅ اشتريت **${shopItem.emoji} ${shopItem.name}** بـ **${shopItem.cost} 💰 فلوس**.\n💰 رصيدك الجديد: **${db[userId].balance} فلوس**.`
                });

                await i.message.edit({ embeds: [buildBagEmbed(userId, db)] });
            }

            await shopMsg.delete().catch(() => {});
        });

        shopCollector.on("end", async (collected, reason) => {
            if (reason === "time") {
                await shopMsg.delete().catch(() => {});
            }
        });
    }
}

// ── إنشاء روم الحقيبة لأول مرة ──
// ── إنشاء روم الحقيبة لأول مرة ──
async function handleCreateBag(interaction) {
    const userId = interaction.user.id;
    const guild  = interaction.guild;

    // 🌟 ضع هنا آيدي الرتبة التي تسمح لها بإنشاء حقيبة (مثال: رتبة مواطن أو لاعب)
    const ALLOWED_ROLE_ID = "ضع_هنا_ايدي_الرتبة_المسموح_لها"; 

    // 🔒 التحقق مما إذا كان الشخص يملك الرتبة المسموح لها
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
        return interaction.reply({
            content: "❌ عذراً، يجب أن تملك الرتبة المخصصة لتتمكن من إنشاء حقيبة خاصة بك!",
            ephemeral: true
        });
    }

    // 🔒 حماية إضافية: التأكد أن الذي ضغط الزر هو صاحب الأمر الأصلي عشان ما حد يلقف على الثاني
    if (interaction.message.interaction && interaction.user.id !== interaction.message.interaction.user.id) {
        return interaction.reply({ 
            content: "❌ هذا الزر مخصص لشخص آخر! اكتب أمر `/الحقيبة` الخاص بك.", 
            ephemeral: true 
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const existing = guild.channels.cache.find(
        c => c.parentId === CATEGORY_ID && c.topic === `BAG_OWNER:${userId}`
    );

    if (existing) {
        return interaction.editReply({
            content: `📦 حقيبتك موجودة بالفعل: ${existing}`
        });
    }

    const channel = await guild.channels.create({
        name: `حقيبة-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        topic: `BAG_OWNER:${userId}`,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: userId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            },
            {
                id: config.adminRole, // رتبة الإدارة المحددة بالكونفق لرؤية الروم
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            }
        ]
    });

    await interaction.editReply({ content: `✅ تم إنشاء حقيبتك: ${channel}` });

    let db = readDB();
    db = ensureUser(db, userId);
    saveDB(db);

    await channel.send({
        content: `👋 أهلاً <@${userId}>! هذي حقيبتك الخاصة.\nاكتب \`/الحقيبة\` بأي وقت لفتحها من جديد.`,
        embeds: [buildBagEmbed(userId, db)],
        components: [buildBagButtons()]
    });
}
module.exports = {
    handleCreateBag,
    handleBagButtonInteraction,
    buildBagEmbed,
    buildBagButtons,
    ensureUser,
    readDB,
    saveDB,
    CATEGORY_ID
};