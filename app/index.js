require("dotenv").config();
const token = process.env.DISCORD_TOKEN;
const fs = require("node:fs");
const path = require("node:path");
// スパム検知のための設定
const SPAM_THRESHOLD_MESSAGES = 5; // 5メッセージ
const SPAM_THRESHOLD_TIME_MS = 5000; // 5秒 (5000ミリ秒)

const userMessageData = new Map(); // Mapを使用してユーザーごとのデータを保存

const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    MessageFlags,
    ChannelType, // ChannelType を追加
} = require("discord.js");

const client = new Client({
    // メッセージの内容を読み取るために GatewayIntentBits.MessageContent が必須です。
    // その他の必要なIntentsも追加しています。
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // これが重要！
        GatewayIntentBits.GuildMembers, // GuildMembers Intent を追加
    ],
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(
                `[あれ] ${filePath}のコマンドには、dataかexecuteのプロパティがないんだってさ。`,
            );
        }
    }
}

const homo_words = [
    "野獣先輩",
    "やじゅうせんぱい",
    "Beast Senpai",
    "beast senpai",
    "beast",
    "Beast",
    "野獣",
    "やじゅう",
    "ホモ",
];

const soudayo = [
    "そうなの",
    "そうなん",
    "そうだよ",
    "そっかぁ",
    "そういうこと",
    "そうかも",
    "そうか",
    "そうっすね",
    "そうやで",
];

const abunai_words = [
    "死ね",
    "消えろ",
    "殺す",
    "殺して",
    "殺してやる",
    "障害者",
    "ガイジ",
    "がいじ",
    "知的障害",
    "しね",
    "きえろ",
    "ころす",
    "ころして",
    "ころしてやる",
    "しょうがいしゃ",
    "ちてきしょうがい",
    "!kiken",
];

// ここに危険なBotのIDを追加
const DANGEROUS_BOT_IDS = [
    "XXXXXXXXXXXXXXXXXX", // 例: '123456789012345678'
    "XXXXXXXXXXXXXXXXXX",
    // 必要に応じてさらに追加
];

client.on("ready", () => {
    console.log(`${client.user.tag}でログインしました!!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(
            `${interaction.commandName}に一致するコマンドが見つかんなかったよ。`,
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "コマンド実行してるときにエラー出たんだってさ。",
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: "コマンド実行してるときにエラー出たんだってさ。",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});

// 新しいメンバーがサーバーに参加したときのイベント
client.on(Events.GuildMemberAdd, async (member) => {
    // 参加したのがBotかどうかをチェック
    if (member.user.bot) {
        // そのBotが危険なBotリストに含まれているかをチェック
        if (DANGEROUS_BOT_IDS.includes(member.user.id)) {
            try {
                // Botを即座にBANする
                await member.ban({ reason: "危険なBotのため自動BAN" });
                console.log(
                    `危険なBot ${member.user.tag} (${member.user.id}) をBANしました。`,
                );

                // ログチャンネルを見つけるか作成する
                let logChannel = member.guild.channels.cache.find(
                    (channel) =>
                        channel.name === "auau-log" &&
                        channel.type === ChannelType.GuildText,
                );

                if (!logChannel) {
                    // auau-log チャンネルが存在しない場合、プライベートチャンネルとして作成
                    logChannel = await member.guild.channels.create({
                        name: "auau-log",
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: member.guild.roles.everyone,
                                deny: ["ViewChannel"], // @everyone からは隠す
                            },
                            {
                                id: client.user.id, // ボット自身は閲覧可能にする
                                allow: ["ViewChannel", "SendMessages"],
                            },
                            // 必要に応じて管理者ロールなどを追加することも可能
                        ],
                        reason: "危険なBotのログ用チャンネルを作成",
                    });
                    console.log(`auau-log チャンネルを作成しました。`);
                }

                // ログチャンネルに通知を送信
                await logChannel.send(
                    `:rotating_light: **危険なBot検知 & BAN** :rotating_light:\n` +
                        `Botの名前: ${member.user.tag}\n` +
                        `BotのID: \`${member.user.id}\`\n` +
                        `理由: 危険なBotリストに含まれていたため、自動的にBANしました。`,
                );
            } catch (error) {
                console.error(
                    `危険なBot (${member.user.id}) のBANまたはログ送信中にエラーが発生しました:`,
                    error,
                );
                // BANに失敗した場合、ボットのプライベートメッセージなどで通知することも検討
            }
        }
    }
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return; // ボット自身のメッセージは無視する

    // スパム検知ロジック
    const userId = msg.author.id;
    const currentTime = Date.now();

    if (!userMessageData.has(userId)) {
        userMessageData.set(userId, { count: 1, lastMessageTime: currentTime });
    } else {
        const userData = userMessageData.get(userId);
        if (currentTime - userData.lastMessageTime < SPAM_THRESHOLD_TIME_MS) {
            userData.count++;
        } else {
            // 設定時間を超えたらリセット
            userData.count = 1;
        }
        userData.lastMessageTime = currentTime;
        userMessageData.set(userId, userData);
    }

    const userData = userMessageData.get(userId);
    if (userData.count > SPAM_THRESHOLD_MESSAGES) {
        try {
            await msg.delete(); // スパムと判断されたメッセージを削除
            const warningMessage = await msg.channel.send(
                `${msg.author}, スパム行為を検知しました。短時間に大量のメッセージを送信しないでください。`,
            );
            // 警告メッセージも一定時間後に削除したい場合は、以下を追加 (任意)
            // setTimeout(() => {
            //     warningMessage.delete().catch((err) =>
            //         console.error("警告メッセージの削除に失敗しました:", err),
            //     );
            // }, 5000); // 5秒後に警告メッセージを削除
            return; // スパム検知された場合はこれ以降の処理を行わない
        } catch (error) {
            console.error("スパムメッセージの削除に失敗しました:", error);
        }
    }

    // メッセージ内容を小文字に変換して、大文字・小文字を区別しない検索を可能にする
    const messageContentLower = msg.content.toLowerCase();

    // 指定された単語リストのいずれかがメッセージに含まれているかチェックするヘルパー関数
    const containsAnyWord = (wordList) =>
        wordList.some((word) =>
            messageContentLower.includes(word.toLowerCase()),
        );

    if (msg.content === "!ping") {
        msg.reply("Botは応答してるよ!");
    } else if (containsAnyWord(homo_words)) {
        // homo_words が含まれていてもメッセージは削除せず、返信のみを行う
        msg.reply(":warning: 淫夢発言を検知しました！！ :warning:");
    } else if (containsAnyWord(soudayo)) {
        msg.reply("そうだよ(便乗)");
    } else if (containsAnyWord(abunai_words)) {
        try {
            // ユーザーのメッセージを削除する前に警告メッセージを送信
            // warningMessage変数にボットが送ったメッセージが格納される
            const warningMessage = await msg.reply(
                `:warning: 危険発言を検知しました！！:warning:\nhttps://i.imgur.com/IEq6RPc.jpeg`,
            );
            // 3秒後にユーザーの元のメッセージを削除
            setTimeout(() => {
                msg.delete().catch((err) =>
                    console.error("元のメッセージの削除に失敗しました:", err),
                );
            }, 100);
            // 以前あった warningMessage.delete() の行を削除しました。
            // これでボットの警告メッセージは残ります。
        } catch (error) {
            console.error(
                "危険発言を含むメッセージの処理中にエラーが発生しました:",
                error,
            );
        }
    }
});

client.login(token);
