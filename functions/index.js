"use strict";

const { dialogflow, SimpleResponse, BasicCard, Image, Suggestions, Button, RegisterUpdate } = require("actions-on-google");
const i18n= require("i18n");
const functions = require("firebase-functions");
const path = require("path");


class GoodQuotes {

    constructor(conv, welcomeIntent = false) {

        this.QUOTES = {};
        this.suggestions = [];
        this.AUTHORS_DATA_FILE = "./author/data.json";

        this.conv = conv;
        this.welcomeIntent = welcomeIntent;
        this.engagement = conv.arguments.get("UPDATES");

        this.quoteObj = this.getRandomQuote();
        this.startingPhrase = this.startingPhrase();

    }


    static getSuggestion (string) {

        return {
            LIKED: i18n.__("SUGGESTION_LIKED"),
            BYE: i18n.__("SUGGESTION_BYE"),
            MORE: i18n.__("SUGGESTION_MORE"),
            DAILY: i18n.__("SUGGESTION_DAILY"),
        }[string];

    }


    static getRandomItem(iterable){

        return iterable[
            Math.floor(
                Math.random() * iterable.length
            )
        ];

    }

    static askForMore(conv) {

        conv.ask(new SimpleResponse({
            speech: i18n.__("MORE"),
            text: i18n.__("DISPLAY_MORE_TEXT"),
        }));

    }


    isHindi() {
        return this.conv.user.locale.startsWith("hi");
    }


    shouldGreet() {
        return this.engagement || this.welcomeIntent;
    }


    greetMessage() {
        return this.shouldGreet() ? i18n.__("GREET") : '';
    }


    getQuotes() {

        const QUOTES_URL = i18n.__('QUOTES_URL');
        this.QUOTES = require(QUOTES_URL);

    }


    getRandomQuote() {

        this.getQuotes();

        const authorList = Object.keys(this.QUOTES);

        const random_author = GoodQuotes.getRandomItem(
            authorList
        );

        const random_quote = GoodQuotes.getRandomItem(
            this.QUOTES[random_author]
        );

        const ID = authorList.indexOf(random_author);

        return {
            "id": ID,
            "author": random_author,
            "quote": random_quote,
        }
    }


    prepareSuggestions() {

        if (!this.engagement) {
            this.suggestions.push(
                GoodQuotes.getSuggestion("DAILY")
            );
        }


        this.suggestions.push(
            GoodQuotes.getSuggestion("MORE"),
            GoodQuotes.getSuggestion("LIKED")
        );

        if (!this.welcomeIntent) {
            this.suggestions.push(
                GoodQuotes.getSuggestion("BYE")
            );
        }

    }


    showSuggestions() {

        this.suggestions = [];
        this.prepareSuggestions();

        this.suggestions = [... new Set(this.suggestions)];

        if (this.conv.screen && !this.engagement) {
            this.conv.ask(
                new Suggestions(this.suggestions)
            );
        }
    }


    getButtonText() {
        if(this.isHindi()) 
            return `${this.quoteObj.author} ${i18n.__("ABOUT")}`;

        return `${i18n.__("ABOUT")} ${this.quoteObj.author}`;
    }


    sayFollowUpText() {

        if(!this.engagement) {
            GoodQuotes.askForMore(this.conv);
        }
    }

    getStartingPhrases() {

        if(this.isHindi()) {
            return [
                `प्रस्तुत है ${this.quoteObj.author} द्वारा एक क्वोट`,
                `${this.quoteObj.author} ने एक बार कहा था`
            ];
        } 

        return [
            `Here's a quote by ${this.quoteObj.author}`,
            `${this.quoteObj.author} once said`
        ]

    }

    getStartingPhrase() {
        return GoodQuotes.getRandomItem(
            this.getStartingPhrases()
        );
    }

    startingPhrase() {

        const greetingMsg = this.greetMessage();
        const startingPhrase = this.getStartingPhrase();

        return `${greetingMsg} ${startingPhrase}`;

    }


    quoteSSML() {
        return `
            <speak>
                ${this.startingPhrase},

                <break time="1s"/>

                <prosody rate="medium" pitch="-2st"> 
                    ${this.quoteObj.quote} 
                </prosody>

                <break time="1s" />
            </speak>`;
    }


    sayQuote() {
        this.conv.ask(
            new SimpleResponse({
                text: this.startingPhrase,
                speech: this.quoteSSML()
            })
        );
    }

    displayCard() {

        if(this.conv.screen) {

            const ID = this.quoteObj.id;
            const authorsData = require(this.AUTHORS_DATA_FILE);

            const currentAuth = Object.keys(
                authorsData
            )[ID];

            const currentAuthData = authorsData[currentAuth];
            const subtitleKeyName = this.isHindi() ? "hi_subtitle": "en_subtitle";

            const cardResponse = new BasicCard({
                text: `***"${this.quoteObj.quote}"***`,
                title: this.quoteObj.author,

                subtitle: currentAuthData[subtitleKeyName],
                link: currentAuthData.link,

                image: new Image({
                    url: currentAuthData.image,
                    alt: this.quoteObj.author
                }),

                buttons: new Button({
                    title: this.getButtonText(),
                    url: currentAuthData.link,
                })
            });

            this.conv.ask(cardResponse);

        }

    }

    closeIfEngagement () {
        if(this.engagement){
            this.conv.close(i18n.__("UPDATE_GOODBYE"))
        }
    }


    say() {
        this.sayQuote();
        this.displayCard();
        this.sayFollowUpText();

        this.showSuggestions();
        this.closeIfEngagement();
    }

}


const app = dialogflow({ debug: true });

i18n.configure({
	locales: ["en-US", "en-IN", "hi-IN"],
	directory: path.join(__dirname, "/locales"),
	defaultLocale: "en-IN"
});


app.middleware(conv => {
	i18n.setLocale(conv.user.locale);
});


app.intent("welcome", conv => {
    new GoodQuotes(conv, true).say();
});

app.intent("good quote", conv => {
    new GoodQuotes(conv).say();
});

app.intent("welcome - more", conv => {
    new GoodQuotes(conv).say();
});

app.intent("good quote - more", conv => {
    new GoodQuotes(conv).say();
});

app.intent("gratitude reply", conv => {

    conv.ask(i18n.__("THANKYOU_USER"));

    GoodQuotes.askForMore(conv);

	if (conv.screen) {
		conv.ask(
			new Suggestions([
                GoodQuotes.getSuggestion("MORE"),
                GoodQuotes.getSuggestion("BYE")
            ])
		);
	}

});

app.intent("Fallback", conv => {

    conv.ask(i18n.__("FALLBACK"));
    GoodQuotes.askForMore(conv);

	if (conv.screen) {
		conv.ask(
			new Suggestions([
                GoodQuotes.getSuggestion("MORE"),
                GoodQuotes.getSuggestion("BYE")
            ])
		);
	}

});

// Start opt-in flow for daily updates
app.intent("Setup Updates", conv => {

	conv.ask(
		new RegisterUpdate({
			intent: "good quote",
			frequency: "DAILY",
		})
	);

});


// Confirm outcome of opt-in for daily updates
app.intent("Confirm Updates", (conv, params, registered) => {

	if (registered && registered.status === "OK") {
		conv.ask(i18n.__("CONFIRM"));
	} else {
		conv.ask(i18n.__("CANCEL_UPDATE"));
	}

    GoodQuotes.askForMore(conv);

	if (conv.screen) {
		conv.ask(
			new Suggestions([
                GoodQuotes.getSuggestion("MORE"),
                GoodQuotes.getSuggestion("LIKED"),
                GoodQuotes.getSuggestion("BYE")
			])
		);
	}
	

});


exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);