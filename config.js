module.exports = {
    token: process.env.TOKEN,

    clientId: "1520924715458494625",
    guildId: "1512915316563509308",

    // وقت الإجابة على السؤال (بالثواني)
    questionTime: 5,

    // الكولداون بين كل تجميع (بالثواني)
    cooldown: 10,

    // رتبة الأدمن المسموح لها بأمر /تصفير
    adminRole: "1521488445464248380",

    // =============================================
    // الأيتمات — تقدر تضيف وتحذف براحتك
    // name: اسم الأيتم
    // emoji: رمز الأيتم
    // reward: الكمية عند التجميع
    // price: سعر البيع بالفلوس
    // =============================================
    items: [
        { name: "ألمنيوم",   emoji: "🪙", reward: 2, price: 100 },
        { name: "حديد",      emoji: "🔩", reward: 2, price: 100 },
        { name: "بلاستيك",  emoji: "🧴", reward: 2, price: 100 },
        { name: "قن باودر", emoji: "💊", reward: 2, price: 100 }
    ],

    // =============================================
    // المتجر — تقدر تضيف وتحذف براحتك
    // name: اسم الغرض | emoji: رمز | cost: سعر الشراء بالفلوس
    // =============================================
    shop: [
        { name: "Hand Cuffs",      emoji: "⛓️",  cost: 10000 },
        { name: "Mk2", emoji: "<:PistolMkII:1521421948473835520>",  cost: 20000 },
        { name: "Pistol.50", emoji: "<:HeavyPistol:1521421894169919598>", cost: 25000  },
        { name: "Pistol Ammo",  emoji: "<:pistol_ammo:1521423037201776680>", cost: 2000 }
    ],

    // الأسئلة (تقدر تضيف وتحذف براحتك)
    questions: [
        { question: "ا", answer: "ا" },
        { question: "ب", answer: "ب" },
        { question: "ي", answer: "ي" },
        { question: "س", answer: "س" },
        { question: "ث", answer: "ث" },
        { question: "غ", answer: "غ" },
        { question: "ع", answer: "ع" },
        { question: "ك", answer: "ك" },
        { question: "ر", answer: "ؤ" },
        { question: "ج", answer: "ج" }
    ],

    embed: {
        color: "#000000",
        footer: "BLACK HAWK"
    }
};

