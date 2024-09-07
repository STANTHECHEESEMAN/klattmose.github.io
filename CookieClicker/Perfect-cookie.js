"use strict";
/**
 * Hello, to add your custom cookie as an option in this, you have to do
 * `new PCSelector.PCType(name,, assets, maybeIcon, maybeRequirement)`
 * So, instead of `Game.Loader.Replace(bleh)`, maybe do:
 * ```js
 * if (window.PCSelector) {
 * 	new PCSelector.PCType("My awesome cookie", { cookie: "link to your cookie" })
 * } else {
 * 	Game.Loader.Replace("perfectCookie.png", "link to your cookie")
 * }
 * ```
 * (Check out ./sourceCode.ts for readable code!)
 */
var PCSelector;
(function (PCSelector) {
    /**
     * A helper function which escapes special regex characters.
     * @param str The string to escape
     * @helper
     */
    function escapeRegExp(str) {
        // eslint-disable-next-line no-useless-escape
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }
    /**
     * A helper helper function, which does a single inject to code
     * @param source The code to perform the inject on
     * @param config The configuration of the inject
     * @helper
     * @helperhelper
     */
    function doSingleInject(source, config) {
        const sliceMode = config[0] === null;
        // Do this to mute typescript silly wrong errors
        let regex = new RegExp("");
        if (config[0] !== null) {
            if (typeof config[0] === "string")
                regex = new RegExp(escapeRegExp(config[0]), "g");
            else
                regex = config[0];
            if (!regex.test(source))
                console.warn("Nothing to inject.");
        }
        const findStart = /(\)[^{]*{)/;
        const findEnd = /(}?)$/;
        switch (config[2]) {
            case "before":
                if (sliceMode)
                    source = source.replace(findStart, `$1${config[1]}`);
                else
                    source = source.replace(regex, `${config[1]}${config[0]}`);
                break;
            case "replace":
                if (sliceMode)
                    source = config[1];
                else
                    source = source.replace(regex, config[1]);
                break;
            case "after":
                if (sliceMode)
                    source = source.replace(findEnd, `${config[1]}$1`);
                else
                    source = source.replace(regex, `${config[0]}${config[1]}`);
                break;
            default:
                throw new Error('where Parameter must be "before", "replace" or "after"');
        }
        return source;
    }
    /**
     * A helper function which replaces(or appends) code in a function, returning the new function, and it's eval free!
     * @param func The source function
     * @param source What to replace, can be null for slicing
     * @param target What to put instead of (or before/after) the source
     * @param where Where to insert or replace your injection
     * @param context The optional context to use
     * @helper
     */
    function injectCode(func, source, target, where, context = {}) {
        const newFunc = Function(...Object.keys(context), `return (${doSingleInject(func.toString(), [source, target, where])})`)(...Object.values(context));
        newFunc.prototype = func.prototype;
        return newFunc;
    }
    PCSelector.modName = "perfectCookieSelector";
    PCSelector.defaultCookieName = "Chocolate chip cookies (Default)";
    PCSelector.webPath = false
        ? "http://localhost:5500/assets"
        : "https://glander.club/perfectCookieSelector";
    PCSelector.save = {
        selectedType: "Default",
        huBought: false,
        lastCookieBought: "Chocolate chip cookies",
    };
    function reportIssue(reason) {
        debugger;
        Game.Prompt(`Hi, ${reason}.<br>Please report this. (${PCSelector.modName})`, ["OK"]);
    }
    function getModPath() {
        if (!App)
            return PCSelector.webPath;
        const steamMod = App.mods[PCSelector.modName];
        if (!steamMod)
            return PCSelector.webPath;
        // This is awful, sorry
        // This finds the second-to-last instance of the forward slash, so
        // ./a/b/c/mods/local/gaming gets local/gaming
        // A lastIndexOf which matches / and \
        function lastIndexOf(str, pos) {
            const forward = str.lastIndexOf("/", pos);
            const backward = str.lastIndexOf("\\", pos);
            return Math.max(forward, backward);
        }
        const splitPoint = lastIndexOf(steamMod.dir, lastIndexOf(steamMod.dir) - 1) + 1;
        return `../mods/${steamMod.dir.slice(splitPoint)}`;
    }
    function getResource(name) {
        return `${getModPath()}/${name}`;
    }
    function waitForValue(valFunc, interval = 100) {
        return new Promise(res => {
            const id = setInterval(() => {
                console.log("check");
                const val = valFunc();
                if (val) {
                    res(val);
                    clearInterval(id);
                }
            }, interval);
        });
    }
    PCSelector.pcTypes = [];
    PCSelector.pcTypesByName = {};
    PCSelector.assetTypes = [
        "cookie",
        "shadow",
        "brokenCookieHalo",
        "brokenCookie",
    ];
    PCSelector.assetTypesRequired = ["cookie"];
    PCSelector.assetAssociatedFiles = {
        brokenCookie: "brokenCookie.png",
        brokenCookieHalo: "brokenCookieHalo.png",
        cookie: "perfectCookie.png",
        shadow: "cookieShadow.png",
    };
    class PCType {
        constructor(name, assetLinks, icon = [25, 12], reqirement) {
            this.name = name;
            this.assetLinks = assetLinks;
            this.icon = icon;
            this.reqirement = reqirement;
            //@ts-expect-error We assign to it later
            this.assetImages = {};
            for (const assetName of PCSelector.assetTypes) {
                if (!(assetName in assetLinks) &&
                    PCSelector.assetTypesRequired.includes(assetName)) {
                    throw new Error("Didn't supply a required asset type!");
                }
                const assetLink = assetLinks[assetName];
                let img;
                if (!assetLink) {
                    img = Game.Loader.assets[PCSelector.assetAssociatedFiles[assetName]];
                }
                else {
                    img = document.createElement("img");
                    img.src = assetLink;
                }
                this.assetImages[assetName] = img;
            }
            PCSelector.pcTypes.push(this);
            PCSelector.pcTypesByName[name] = this;
        }
    }
    PCSelector.PCType = PCType;
    class PCCookieType extends PCType {
        constructor(upgrade, assets) {
            super(upgrade.name, assets, upgrade.icon, () => !!upgrade.bought);
        }
    }
    PCSelector.PCCookieType = PCCookieType;
    PCSelector.ready = false;
    function updatePerfectCookie() {
        if (!PCSelector.ready)
            return;
        const selectedType = getActivePC();
        if (!selectedType) {
            reportIssue("couldn't find a perfect cookie type");
            return;
        }
        for (const assetType of PCSelector.assetTypes) {
            const asset = selectedType.assetImages[assetType];
            if (!asset) {
                reportIssue(`couldn't find a perfect cookie asset (${assetType} in ${selectedType.name})`);
                return;
            }
            Game.Loader.assets[PCSelector.assetAssociatedFiles[assetType]] = asset;
        }
    }
    PCSelector.updatePerfectCookie = updatePerfectCookie;
    let hu;
    let upgrade;
    function onUpgradeBuy(upgrade, success) {
        if (upgrade.pool !== "cookie" || !success || !PCSelector.pcTypesByName[upgrade.name])
            return;
        PCSelector.save.lastCookieBought = upgrade.name;
    }
    PCSelector.onUpgradeBuy = onUpgradeBuy;
    function getActivePC() {
        if (!upgrade.unlocked)
            return PCSelector.pcTypesByName[PCSelector.defaultCookieName];
        let type;
        type =
            PCSelector.pcTypesByName[PCSelector.save.selectedType === null ? PCSelector.save.lastCookieBought : PCSelector.save.selectedType];
        if ((type === null || type === void 0 ? void 0 : type.reqirement) && !type.reqirement())
            type = undefined;
        if (type)
            return type;
        // Fall back to the default cookie
        return PCSelector.pcTypesByName[PCSelector.defaultCookieName];
    }
    PCSelector.getActivePC = getActivePC;
    Game.registerMod(PCSelector.modName, {
        async init() {
            var _a, _b;
            Game.Upgrade.prototype.buy = injectCode(Game.Upgrade.prototype.buy, "return success;", "PCSelector.onUpgradeBuy(this, success);\n", "before");
            Game.DrawBackground = injectCode(Game.DrawBackground, "ctx.drawImage(Pic('brokenCookie.png'),256*(chunks[i]),0,256,256", `const brokenSize = Pic('brokenCookie.png').height;
ctx.drawImage(Pic('brokenCookie.png'),brokenSize*(chunks[i]),0,brokenSize,brokenSize`, "replace");
            hu = new Game.Upgrade("Dessert showcase", `Unlocks the <b>Perfect cookie selector</b>, letting you select your unlocked cookies as the perfect cookie on the left.<br>
Comes with a variety of basic flavors. <q>Show and admire your all cookies like artworks, so sweet~</q>`, 999, [0, 0, getResource("pcs_icon.png")]);
            hu.ddesc = loc(hu.desc);
            hu.dname = loc(hu.name);
            hu.parents = [Game.Upgrades["Basic wallpaper assortment"]];
            hu.pool = "prestige";
            Game.PrestigeUpgrades.push(hu);
            if (Game.version >= 2.045) {
                hu.posX = 423;
                hu.posY = 250;
            }
            else {
                hu.posX = 323;
                hu.posY = 273;
            }
            upgrade = new Game.Upgrade("Perfect cookie selector", "Lets you pick what flavor of perfect cookie to display.", 0, [0, 0, getResource("pcs_icon.png")]);
            upgrade.descFunc = () => {
                let name;
                let icon;
                if (!PCSelector.save.selectedType) {
                    name = "Automatic";
                    icon = [0, 7];
                }
                else {
                    const selectedType = getActivePC();
                    name = selectedType.name;
                    icon = selectedType.icon;
                }
                return `<div style="text-align:center;">${loc("Current:")} <div class="icon" style="vertical-align:middle;display:inline-block;${writeIcon(icon)}transform:scale(0.5);margin:-16px;"></div> <b>${loc(name)}</b></div><div class="line"></div>${upgrade.ddesc}`;
            };
            upgrade.ddesc = loc(upgrade.desc);
            upgrade.dname = loc(upgrade.name);
            upgrade.order = 50000 + upgrade.id / 1000;
            upgrade.pool = "toggle";
            //@ts-expect-error This also takes PseudoNulls
            upgrade.choicesFunction = () => {
                const types = PCSelector.pcTypes.map(val => {
                    if (val.reqirement && !val.reqirement())
                        return 0;
                    return {
                        name: loc(val.name),
                        icon: val.icon,
                        selected: val.name === PCSelector.save.selectedType,
                    };
                });
                types.unshift({
                    icon: [0, 7],
                    name: "Automatic",
                    selected: PCSelector.save.selectedType === null,
                });
                return types;
            };
            upgrade.choicesPick = (num) => {
                if (num === 0)
                    PCSelector.save.selectedType = null;
                else {
                    const chosen = PCSelector.pcTypes[num - 1];
                    PCSelector.save.selectedType = chosen.name;
                }
                updatePerfectCookie();
            };
            Game.registerHook("reset", hard => {
                PCSelector.save.selectedType = null;
                if (hard)
                    PCSelector.save.huBought = false;
            });
            Game.registerHook("logic", () => {
                updatePerfectCookie();
            });
            Game.registerHook("reincarnate", () => {
                upgrade.unlocked = !!Game.Has(hu.name);
                if (upgrade.unlocked) {
                    const candidates = [];
                    candidates.push(PCSelector.pcTypesByName[PCSelector.defaultCookieName]);
                    for (const cookie of Game.cookieUpgrades) {
                        if (cookie.pool === "prestige" &&
                            cookie.bought &&
                            PCSelector.pcTypesByName[cookie.name]) {
                            candidates.push(PCSelector.pcTypesByName[cookie.name]);
                        }
                    }
                    PCSelector.save.lastCookieBought =
                        candidates[Math.floor(Math.random() * candidates.length)].name;
                }
                updatePerfectCookie();
            });
            Game.Loader.Load(["perfectCookie.png", "cookieShadow.png"]);
            await waitForValue(() => Game.Loader.assets["perfectCookie.png"] &&
                Game.Loader.assets["cookieShadow.png"]);
            new PCType(PCSelector.defaultCookieName, { cookie: null }, [10, 0]);
            function createCookieType(name, overrides) {
                var _a, _b, _c, _d;
                const cookieName = name.toLocaleLowerCase().replace(/ /g, "_");
                const shortName = cookieName.replace(/_(cookies|biscuits)$/, "");
                new PCCookieType(Game.Upgrades[name], {
                    cookie: getResource(`cookieImages/${(_a = overrides === null || overrides === void 0 ? void 0 : overrides.cookie) !== null && _a !== void 0 ? _a : cookieName}.png`),
                    brokenCookie: getResource(`cookieBroken/${(_b = overrides === null || overrides === void 0 ? void 0 : overrides.brokenCookie) !== null && _b !== void 0 ? _b : `${shortName}_broken`}.png`),
                    brokenCookieHalo: getResource(`cookieHalos/${(_c = overrides === null || overrides === void 0 ? void 0 : overrides.brokenCookieHalo) !== null && _c !== void 0 ? _c : "cookie_halo"}.png`),
                    shadow: getResource(`cookieShadows/${(_d = overrides === null || overrides === void 0 ? void 0 : overrides.shadow) !== null && _d !== void 0 ? _d : "cookie_shadow"}.png`),
                });
            }
            createCookieType("Heavenly cookies", {
                shadow: "heavenly_light",
                brokenCookieHalo: "heavenly_halo",
            });
            createCookieType("Snowflake biscuits", {
                shadow: "snowflake_shadow",
                brokenCookieHalo: "snowflake_halo",
            });
            createCookieType("Pure heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "pure_heart_halo",
            });
            createCookieType("Ardent heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "heart_halo",
            });
            createCookieType("Sour heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "heart_halo",
            });
            createCookieType("Weeping heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "heart_halo",
            });
            createCookieType("Golden heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "heart_halo",
            });
            createCookieType("Eternal heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "heart_halo",
            });
            createCookieType("Prism heart biscuits", {
                shadow: "heart_shadow",
                brokenCookieHalo: "prism_heart_halo",
            });
            createCookieType("Wrinkly cookies", {
                brokenCookieHalo: "wrinkly_halo",
            });
            createCookieType("Sugar crystal cookies", {
                brokenCookieHalo: "sugar_crystal_halo",
            });
            createCookieType("Zebra cookies");
            createCookieType("Eclipse cookies");
            createCookieType("Plain cookies");
            createCookieType("Cookie crumbs", {
                brokenCookieHalo: "cookie_crumbs_halo",
            });
            createCookieType("Sugar cookies", { brokenCookieHalo: "sugar_halo" });
            createCookieType("Oatmeal raisin cookies", {
                brokenCookieHalo: "bumpy_cookie_halo",
            });
            createCookieType("Peanut butter cookies", {
                brokenCookieHalo: "bumpy_cookie_halo",
            });
            PCSelector.ready = true;
            (_a = this.load) === null || _a === void 0 ? void 0 : _a.call(this, ((_b = this.save) === null || _b === void 0 ? void 0 : _b.call(this)) || "");
        },
        save() {
            PCSelector.save.huBought = !!hu.bought;
            return JSON.stringify(PCSelector.save);
        },
        load(data) {
            PCSelector.save = JSON.parse(data);
            updatePerfectCookie();
            hu.bought = PCSelector.save.huBought;
            upgrade.unlocked = Game.Has(hu.name);
            if (!PCSelector.save.lastCookieBought)
                PCSelector.save.lastCookieBought = "Chocolate chip cookie";
            Game.upgradesToRebuild = 1;
        },
    });
})(PCSelector || (PCSelector = {}));
