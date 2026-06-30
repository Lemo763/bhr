const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require("discord.js");

const config = require("../config");
const { readDB, saveDB, ensureUser, CATEGORY_ID } = require("./bag-handler");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("تلويت")
        .setDescription("طلب أخذ مورد أو غرض من حقيبة شخص آخر")
        .addUserOption(option => 
            option.setName("الشخص")
                .setDescription("الشخص الذي تريد التلويت منه")
                .setRequired(true))
        .addStringOption(option => 
            option.setName("المورد")
                .setDescription("اسم المورد أو الغرض المراد أخذه (مثل: قن باودر أو Mk2)")
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName("الكمية")
                .setDescription("الكمية المراد أخذها")
                .setRequired(true)),

    async execute(interaction) {
        const looter = interaction.user;
        const targetUser = interaction.options.getUser("الشخص");
        const itemName = interaction.options.getString("المورد").trim();
        const amount = interaction.options.getInteger("الكمية");
        const guild = interaction.guild;

        // 1. الحمايات الأساسية والتحقق من المدخلات
        if (targetUser.id === looter.id) {
            return interaction.reply({ content: "❌ لا يمكنك تلويت نفسك!", ephemeral: true });
        }
        if (targetUser.bot) {
            return interaction.reply({ content: "❌ لا يمكنك تلويت البوتات!", ephemeral: true });
        }
        if (amount <= 0) {
            return interaction.reply({ content: "❌ يجب أن تكون الكمية أكبر من 0!", ephemeral: true });
        }

        // 🛑 استثناء التيزر من التلويت تماماً
        if (itemName.toLowerCase() === "تيزر" || itemName.toLowerCase() === "tazer" || itemName.toLowerCase() === "stun gun") {
            return interaction.reply({ content: "❌ صودر الأمر! لا يمكن تلويت سلاح التيزر بتاتاً.", ephemeral: true });
        }

        // 🔍 الفحص التلقائي وتحديد هل الغرض من المتجر أم من الموارد العادية
        const isShopItem = config.shop.find(x => x.name.toLowerCase() === itemName.toLowerCase());
        const isNormalItem = config.items.find(x => x.name.toLowerCase() === itemName.toLowerCase());
        const validItem = isShopItem || isNormalItem;
        
        if (!validItem) {
            return interaction.reply({ content: `❌ المورد أو الغرض **${itemName}** غير موجود في نظام السيرفر.`, ephemeral: true });
        }

        const exactItemName = validItem.name; // الاسم الرسمي الحقيقي المسجل بالـ config

        // 🔍 البحث عن روم حقيبة الشخص المستهدف (الضحية)
        const targetChannel = guild.channels.cache.find(
            c => c.parentId === CATEGORY_ID && c.topic === `BAG_OWNER:${targetUser.id}`
        );

        if (!targetChannel) {
            return interaction.reply({ 
                content: `❌ لا يمكن إرسال طلب التلويت لأن <@${targetUser.id}> لا يملك روم حقيبة مفتوحة حالياً!`, 
                ephemeral: true 
            });
        }

        // 2. قراءة قاعدة البيانات والتأكد من وجود المستخدمين وحقائبهم
        let db = readDB();
        db = ensureUser(db, looter.id);
        db = ensureUser(db, targetUser.id);

        // [تحديث هام]: تحديد الكائن الصحيح للبحث (items أو shopItems) بناءً على نوع الغرض
        const dbLocation = isShopItem ? "shopItems" : "items";

        // التحقق من الكمية المتوفرة لدى الضحية
        const targetAmount = db[targetUser.id][dbLocation][exactItemName] ?? 0;
        if (targetAmount < amount) {
            return interaction.reply({ 
                content: `❌ <@${targetUser.id}> لا يملك كمية كافية من **${exactItemName}**. (يمتلك حالياً: ${targetAmount})`, 
                ephemeral: true 
            });
        }

        // 3. بناء رسالة طلب التلويت (Embed & الأزرار)
        const embed = new EmbedBuilder()
            .setColor("#E67E22")
            .setTitle("🚨 طلب لوت / تفتيش جديد 🚨")
            .setDescription(`قام ${looter} بطلب أخذ موارد من حقيبتك كـ لوت.`)
            .addFields(
                { name: "📦 المورد المطلوب:", value: `${validItem.emoji} **${exactItemName}**`, inline: true },
                { name: "🔢 الكمية المطلوبة:", value: `**${amount}**`, inline: true }
            )
            .setFooter({ text: `© ${config.embed?.footer || "السيرفر"} | 2026` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("approve_loot")
                .setLabel("✅ موافقة وتسليم")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("deny_loot")
                .setLabel("❌ رفض الطلب")
                .setStyle(ButtonStyle.Danger)
        );

        // الرد على الملوّت بشكل مخفي لتأكيد الطلب
        await interaction.reply({ 
            content: `⏳ جاري إرسال طلب التلويت إلى روم حقيبة المستهدف بنجاح: ${targetChannel}`, 
            ephemeral: true 
        });

        // إرسال الرسالة داخل روم حقيبة الضحية
        const msg = await targetChannel.send({
            content: `<@${targetUser.id}>، لديك طلب لوت من قبل ${looter}!`,
            embeds: [embed],
            components: [row]
        });

        // 4. عمل مستمع للأزرار (Collector) يستجيب فقط للشخص المستهدف
        const filter = i => i.user.id === targetUser.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on("collect", async i => {
            db = readDB(); // إعادة القراءة لمنع ثغرات التكرار
            
            if (i.customId === "approve_loot") {
                if ((db[targetUser.id][dbLocation][exactItemName] ?? 0) < amount) {
                    return i.update({ content: "❌ فشلت العملية! لم تعد الكمية متوفرة في الحقيبة.", embeds: [], components: [] });
                }

                // نقل الغرض بين الحقائب باستخدام المسار الصحيح (items أو shopItems)
                db[targetUser.id][dbLocation][exactItemName] -= amount;
                db[looter.id][dbLocation][exactItemName] = (db[looter.id][dbLocation][exactItemName] ?? 0) + amount;

                saveDB(db);

                const successEmbed = new EmbedBuilder()
                    .setColor("#2ECC71")
                    .setTitle("✅ تم التلويت ونقل الموارد")
                    .setDescription(`وافقتَ على تسليم الموارد وجرى نقلها مباشرة إلى حقيبة ${looter}.`)
                    .addFields(
                        { name: "📦 المورد/الأداة:", value: `${validItem.emoji} ${exactItemName}`, inline: true },
                        { name: "🔢 الكمية المنقولة:", value: `**${amount}**`, inline: true }
                    )
                    .setTimestamp();

                await i.update({ content: "✅ تمت عملية التلويت بنجاح!", embeds: [successEmbed], components: [] });
                
                try {
                    await looter.send(`✅ وافق <@${targetUser.id}> على طلب اللوت، وجرى نقل **${amount}x ${exactItemName}** إلى حقيبتك بنجاح!`);
                } catch (err) {}

                collector.stop();
            } 
            
            else if (i.customId === "deny_loot") {
                const denyEmbed = new EmbedBuilder()
                    .setColor("#C0392B")
                    .setTitle("❌ تم رفض طلب التلويت")
                    .setDescription(`قمت برفض تسليم الموارد لـ ${looter}.`)
                    .setTimestamp();

                await i.update({ content: "❌ تم الرفض!", embeds: [denyEmbed], components: [] });
                
                try {
                    await looter.send(`❌ رفض <@${targetUser.id}> طلب التلويت الخاص بك لمورد **${exactItemName}**.`);
                } catch (err) {}

                collector.stop();
            }
        });

        collector.on("end", async (collected, reason) => {
            if (reason === "time") {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor("#7F8C8D")
                    .setTitle("⏱️ انتهى وقت الطلب")
                    .setDescription(`انتهى الوقت المحدد دون اتخاذ إجراء على طلب التلويت.`);
                await msg.edit({ content: "⏱️ انتهى الوقت دون رد!", embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};