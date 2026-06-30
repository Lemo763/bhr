const fs = require("fs");
const config = require("./config");

const file = "./inventory.json";

function load() {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "{}");
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

function createUser(userId) {
    const data = load();

    if (!data[userId]) {
        data[userId] = {};

        for (const item in config.rewards) {
            data[userId][item] = 0;
        }

        save(data);
    }

    return data;
}

function add(userId, resource, amount) {
    const data = createUser(userId);

    if (!data[userId][resource])
        data[userId][resource] = 0;

    data[userId][resource] += amount;

    save(data);
}

function get(userId) {
    const data = createUser(userId);

    return data[userId];
}

function reset(userId) {
    const data = createUser(userId);

    for (const item in config.rewards) {
        data[userId][item] = 0;
    }

    save(data);
}

module.exports = {
    add,
    get,
    reset
};