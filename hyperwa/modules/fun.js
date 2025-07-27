const axios = require('axios');

class FunModule {
    constructor(bot) {
        this.bot = bot;
        this.name = 'fun';
        this.metadata = {
            description: 'Fun commands and games for entertainment',
            version: '1.0.0',
            author: 'HyperWa Team',
            category: 'entertainment',
            dependencies: ['axios']
        };
        this.commands = [
            {
                name: 'joke',
                description: 'Get a random joke',
                usage: '.joke [category]',
                permissions: 'public',
                ui: {
                    processingText: '😄 *Finding a joke...*\n\n⏳ Preparing to make you laugh...',
                    errorText: '❌ *Joke Failed*'
                },
                execute: this.getJoke.bind(this)
            },
            {
                name: 'fact',
                description: 'Get a random fact',
                usage: '.fact',
                permissions: 'public',
                ui: {
                    processingText: '🧠 *Finding an interesting fact...*\n\n⏳ Searching knowledge base...',
                    errorText: '❌ *Fact Retrieval Failed*'
                },
                execute: this.getFact.bind(this)
            },
            {
                name: 'quote',
                description: 'Get an inspirational quote',
                usage: '.quote',
                permissions: 'public',
                ui: {
                    processingText: '💭 *Finding inspiration...*\n\n⏳ Searching for wisdom...',
                    errorText: '❌ *Quote Retrieval Failed*'
                },
                execute: this.getQuote.bind(this)
            },
            {
                name: 'meme',
                description: 'Get a random meme',
                usage: '.meme [subreddit]',
                permissions: 'public',
                ui: {
                    processingText: '😂 *Finding a meme...*\n\n⏳ Browsing the internet...',
                    errorText: '❌ *Meme Retrieval Failed*'
                },
                execute: this.getMeme.bind(this)
            },
            {
                name: 'trivia',
                description: 'Start a trivia game',
                usage: '.trivia [category]',
                permissions: 'public',
                ui: {
                    processingText: '🧩 *Preparing trivia...*\n\n⏳ Loading questions...',
                    errorText: '❌ *Trivia Failed*'
                },
                execute: this.startTrivia.bind(this)
            },
            {
                name: 'dice',
                description: 'Roll a dice',
                usage: '.dice [sides]',
                permissions: 'public',
                execute: this.rollDice.bind(this)
            },
            {
                name: 'flip',
                description: 'Flip a coin',
                usage: '.flip',
                permissions: 'public',
                execute: this.flipCoin.bind(this)
            },
            {
                name: '8ball',
                description: 'Ask the magic 8-ball',
                usage: '.8ball <question>',
                permissions: 'public',
                execute: this.magic8Ball.bind(this)
            }
        ];
        this.triviaGames = new Map();
        this.eightBallResponses = [
            "It is certain", "Reply hazy, try again", "Don't count on it",
            "It is decidedly so", "Ask again later", "My reply is no",
            "Without a doubt", "Better not tell you now", "My sources say no",
            "Yes definitely", "Cannot predict now", "Outlook not so good",
            "You may rely on it", "Concentrate and ask again", "Very doubtful",
            "As I see it, yes", "Most likely", "Outlook good",
            "Yes", "Signs point to yes"
        ];
    }

    async init() {
        console.log('✅ Fun module initialized');
    }

    async getJoke(msg, params, context) {
        try {
            const category = params[0] || 'any';
            
            // This would integrate with a jokes API
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "Why did the scarecrow win an award? He was outstanding in his field!",
                "Why don't eggs tell jokes? They'd crack each other up!",
                "What do you call a fake noodle? An impasta!",
                "Why did the math book look so sad? Because it had too many problems!"
            ];

            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

            return `😄 *Random Joke*\n\n${randomJoke}\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Failed to get joke: ${error.message}`);
        }
    }

    async getFact(msg, params, context) {
        try {
            // This would integrate with a facts API
            const facts = [
                "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
                "A group of flamingos is called a 'flamboyance'.",
                "Bananas are berries, but strawberries aren't.",
                "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
                "Octopuses have three hearts and blue blood."
            ];

            const randomFact = facts[Math.floor(Math.random() * facts.length)];

            return `🧠 *Interesting Fact*\n\n${randomFact}\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Failed to get fact: ${error.message}`);
        }
    }

    async getQuote(msg, params, context) {
        try {
            // This would integrate with a quotes API
            const quotes = [
                "\"The only way to do great work is to love what you do.\" - Steve Jobs",
                "\"Innovation distinguishes between a leader and a follower.\" - Steve Jobs",
                "\"Life is what happens to you while you're busy making other plans.\" - John Lennon",
                "\"The future belongs to those who believe in the beauty of their dreams.\" - Eleanor Roosevelt",
                "\"It is during our darkest moments that we must focus to see the light.\" - Aristotle"
            ];

            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

            return `💭 *Inspirational Quote*\n\n${randomQuote}\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Failed to get quote: ${error.message}`);
        }
    }

    async getMeme(msg, params, context) {
        try {
            const subreddit = params[0] || 'memes';
            
            // This would integrate with Reddit API or meme API
            return `😂 *Meme Request*\n\n📱 Subreddit: r/${subreddit}\n📝 Note: Meme functionality requires API integration with Reddit or meme services.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Failed to get meme: ${error.message}`);
        }
    }

    async startTrivia(msg, params, context) {
        const userId = context.participant;
        const category = params[0] || 'general';

        try {
            // Check if user already has an active game
            if (this.triviaGames.has(userId)) {
                return '🧩 *Trivia Game*\n\nYou already have an active trivia game! Answer the current question first.';
            }

            // Sample trivia questions
            const questions = [
                {
                    question: "What is the capital of France?",
                    options: ["London", "Berlin", "Paris", "Madrid"],
                    correct: 2
                },
                {
                    question: "Which planet is known as the Red Planet?",
                    options: ["Venus", "Mars", "Jupiter", "Saturn"],
                    correct: 1
                },
                {
                    question: "What is 2 + 2?",
                    options: ["3", "4", "5", "6"],
                    correct: 1
                }
            ];

            const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
            
            // Store the game state
            this.triviaGames.set(userId, {
                question: randomQuestion,
                startTime: Date.now(),
                score: 0
            });

            let questionText = `🧩 *Trivia Question*\n\n❓ ${randomQuestion.question}\n\n`;
            randomQuestion.options.forEach((option, index) => {
                questionText += `${index + 1}. ${option}\n`;
            });
            questionText += `\n💡 Reply with the number (1-4) of your answer!`;

            return questionText;

        } catch (error) {
            throw new Error(`Failed to start trivia: ${error.message}`);
        }
    }

    async rollDice(msg, params, context) {
        const sides = parseInt(params[0]) || 6;
        
        if (sides < 2 || sides > 100) {
            return '❌ *Invalid Dice*\n\nDice must have between 2 and 100 sides.';
        }

        const result = Math.floor(Math.random() * sides) + 1;
        
        return `🎲 *Dice Roll*\n\n🎯 **Result:** ${result}\n🔢 **Sides:** ${sides}\n\n⏰ ${new Date().toLocaleTimeString()}`;
    }

    async flipCoin(msg, params, context) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '👑' : '⚡';
        
        return `🪙 *Coin Flip*\n\n${emoji} **Result:** ${result}\n\n⏰ ${new Date().toLocaleTimeString()}`;
    }

    async magic8Ball(msg, params, context) {
        if (params.length === 0) {
            return '❌ *Magic 8-Ball*\n\nPlease ask a question.\n\n💡 Usage: `.8ball Will I be successful?`';
        }

        const question = params.join(' ');
        const response = this.eightBallResponses[Math.floor(Math.random() * this.eightBallResponses.length)];
        
        return `🎱 *Magic 8-Ball*\n\n❓ **Question:** ${question}\n\n🔮 **Answer:** ${response}\n\n⏰ ${new Date().toLocaleTimeString()}`;
    }

    // Message hook to handle trivia answers
    messageHooks = {
        'pre_process': async (msg, text, bot) => {
            const userId = msg.key.participant || msg.key.remoteJid;
            
            if (this.triviaGames.has(userId) && text && /^[1-4]$/.test(text.trim())) {
                const game = this.triviaGames.get(userId);
                const answer = parseInt(text.trim()) - 1;
                const isCorrect = answer === game.question.correct;
                
                this.triviaGames.delete(userId);
                
                let resultText = `🧩 *Trivia Result*\n\n`;
                if (isCorrect) {
                    resultText += `✅ **Correct!**\n\n🎉 Well done! The answer was: ${game.question.options[game.question.correct]}`;
                } else {
                    resultText += `❌ **Incorrect!**\n\n💡 The correct answer was: ${game.question.options[game.question.correct]}`;
                }
                
                resultText += `\n\n⏰ ${new Date().toLocaleTimeString()}`;
                
                await bot.sendMessage(msg.key.remoteJid, { text: resultText });
            }
        }
    };

    async destroy() {
        this.triviaGames.clear();
        console.log('🛑 Fun module destroyed');
    }
}

module.exports = FunModule;