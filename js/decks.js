'use strict';
/* =====================================================================
   Deck lists. Bot decks: precon + 20 upgrades, then the weakest original
   precon creatures are cut until the deck is exactly 99 + commander.
   ===================================================================== */
const ones = (names) => names.map(n => [n, 1]);

const SHAY_LIST = [
  ...ones([
    // wipes (9)
    'Vanquish the Horde', 'Wrath of God', 'Day of Judgment', 'Fumigate', 'Austere Command', 'Planar Outburst', 'Hour of Revelation', 'Unstable Glyphbridge', "Cloud's Limit Break",
    // protect Shay (8)
    "Professor's Warning", 'Unbreakable Formation', 'Valorous Stance', 'Make a Stand', 'Selfless Spirit', 'Sheltering Light', 'Zack Fair', 'Bastion Protector',
    // deathtouch (8)
    'Noxious Groodion', 'Yuan-Ti Fang-Blade', 'Rancid Rats', 'Dhund Operative', 'Touch of Moonglove', 'Typhoid Rats', 'Gifted Aetherborn', 'Vampire Nighthawk',
    // taggers and removal (16)
    'Bleed Dry', 'Sorceress Queen', 'Tidy Conclusion', 'Flesh to Dust', 'Murderous Compulsion', 'Compulsory Rest', 'Jarl of the Forsaken', 'Tragic Banshee', "Gideon's Lawkeeper", 'Ravenous Chupacabra', 'Skinrender', 'Go for the Throat', 'Doom Blade', 'Hex', 'Goldmeadow Harrier', 'Blinding Mage',
    // blockers, recursion, draw
    'Unhallowed Phalanx', 'Gravedigger', 'March of the Returned', 'Grisly Transformation',
    // ramp (5)
    'Arcane Signet', 'Orzhov Signet', 'Mind Stone', 'Talisman of Hierarchy', 'Sol Ring',
    // evasion (4)
    'Whispersilk Cloak', 'Gift of Orzhova', 'Behind the Scenes', "Prowler's Helm",
    // engine, tutors, defense
    'Teysa Karlov', "Night's Whisper", 'Diabolic Tutor', "Steelshaper's Gift", 'Settle the Wreckage',
    // upgrades (5)
    'Ghostly Prison', 'Skullclamp', 'Blood Artist', 'Swiftfoot Boots', 'Darksteel Plate',
    // nonbasic lands
    "Rogue's Passage", 'Scoured Barrens', 'Orzhov Basilica',
  ]),
  ['Plains', 16], ['Swamp', 16],
];

const ELENDA_CUT = ["Gideon's Lawkeeper", 'Goldmeadow Harrier', 'Blinding Mage', 'Sorceress Queen'];
const ELENDA_ADD = ['Shay Cormac', 'Viscera Seer', 'Zulaport Cutthroat', 'Cruel Celebrant'];
const CLOUD_PRECON_CREATURES = ['Tifa, Martial Artist', 'Cid, Freeflier Pilot', 'Elena, Turk Recruit', 'Heidegger, Shinra Executive', 'Helitrooper', 'Cait Sith, Fortune Teller', 'Vincent, Vengeful Atoner', 'Yuffie, Materia Hunter', 'Bugenhagen, Wise Elder', 'Professor Hojo', 'Aerith, Last Ancient', 'Barret, Avalanche Leader', 'Red XIII, Proud Warrior', 'Sephiroth, Fallen Hero', 'Bastion Protector', 'Bronze Guardian', 'Puresteel Paladin', 'Hellkite Tyrant', 'Professional Face-Breaker', 'Armory Automaton', 'Zack Fair', 'Summon: Kujata'];
const CLOUD_CUT = ['Helitrooper', 'Bugenhagen, Wise Elder', 'Professor Hojo', 'Cid, Freeflier Pilot', 'Elena, Turk Recruit', 'Heidegger, Shinra Executive', 'Cait Sith, Fortune Teller', 'Yuffie, Materia Hunter', 'Zack Fair', 'Armory Automaton', 'Professional Face-Breaker', 'Aerith, Last Ancient', 'Red XIII, Proud Warrior', 'Bronze Guardian'];
const CLOUD_PRECON_OTHER = ["Cloud's Limit Break", 'Ultimate Magic: Holy', 'Ultimate Magic: Meteor', 'Shuriken', 'Wrecking Ball', 'Austere Command', 'Clever Concealment', 'Unfinished Business', 'Vanquish the Horde', 'Chaos Warp', 'Decimate', 'Furious Rise', 'Vandalblast', 'Cultivate', 'Harmonize', "Nature's Lore", 'Rampant Growth', 'Secret Rendezvous', 'Dispatch', 'Behemoth Sledge', 'Arcane Signet', 'Colossus Hammer', "Explorer's Scope", "Hero's Blade", "Hero's Heirloom", 'Lightning Greaves', 'Mask of Memory', 'Skullclamp', 'Sol Ring', "Trailblazer's Boots", "Champion's Helm", "Conqueror's Flail", 'Darksteel Plate', 'Sword of the Animist', 'Conformer Shuriken'];
const CLOUD_UPGRADES = ["Sigarda's Aid", 'Stoneforge Mystic', 'Sword of Feast and Famine', 'Sword of Fire and Ice', 'Embercleave', 'Swords to Plowshares', 'Path to Exile', "Teferi's Protection", 'Heroic Intervention', 'Boros Charm', 'Three Visits', 'Farseek', "Kodama's Reach", 'Smothering Tithe', 'Sunforger', 'Fighter Class', "Kemba's Skyguard", "Akroma's Will", 'Shadowspear', 'Blackblade Reforged'];

const SAI_PRECON_CREATURES = ['Broodstar', 'Chief of the Foundry', 'Darksteel Juggernaut', 'Duplicant', 'Etherium Sculptor', 'Foundry Inspector', 'Graaz, Unstoppable Juggernaut', 'Kappa Cannoneer', 'Master of Etherium', 'Master Transmuter', 'Memory Guardian', 'Meteor Golem', 'Myr Battlesphere', 'Myr Retriever', 'Ornithopter of Paradise', 'Padeem, Consul of Innovation', 'Palladium Myr', 'Psychosis Crawler', 'Research Thief', 'Scrawling Crawler', 'Shimmer Dragon', 'Shimmer Myr', 'Silver Myr', 'Spire Golem', 'Steel Hellkite', 'Steel Overseer', 'Thought Monitor', 'Vedalken Archmage', 'Whirler Rogue'];
const SAI_CUT = ['Darksteel Juggernaut', 'Etherium Sculptor', 'Foundry Inspector', 'Graaz, Unstoppable Juggernaut', 'Master Transmuter', 'Memory Guardian', 'Myr Retriever', 'Ornithopter of Paradise', 'Padeem, Consul of Innovation', 'Palladium Myr', 'Psychosis Crawler', 'Research Thief', 'Scrawling Crawler', 'Shimmer Myr', 'Silver Myr', 'Spire Golem', 'Steel Overseer', 'Vedalken Archmage'];
const SAI_PRECON_OTHER = ['Adaptive Omnitool', 'Aether Spellbomb', 'Arcane Signet', "Cultivator's Caravan", 'Forsaken Monument', 'Hedron Archive', 'Ichor Wellspring', 'Mazemind Tome', 'Mind Stone', "Mind's Eye", 'Misleading Signpost', 'Nettlecyst', "Nevinyrral's Disk", 'Skysovereign, Consul Flagship', 'Sol Ring', 'Soul-Guide Lantern', "Tamiyo's Logbook", 'Thopter Fabricator', 'Thought Vessel', 'All Is Dust', 'Thoughtcast', 'Aetherize', 'Counterspell', 'Launch Mishap', 'Negate', 'Pull from Tomorrow', 'Thirst for Knowledge', 'Fall from Favor', 'Propaganda', 'Thopter Spy Network'];
const SAI_UPGRADES = ['Ornithopter', 'Memnite', 'Hangarback Walker', 'Thopter Foundry', 'Whir of Invention', 'Urza, Lord High Artificer', 'Cyclonic Rift', 'Rhystic Study', 'Mystic Remora', 'Fierce Guardianship', 'Arcane Denial', 'Swan Song', 'Retrofitter Foundry', 'Glimmervoid', 'Cranial Plating', "Liberator, Urza's Battlethopter", 'Ichormoon Gauntlet', 'Chief Engineer', 'Mechanized Production', 'Whirler Virtuoso'];

const ELENDA_BOT_BASE = [
  // ramp (6)
  'Sol Ring', 'Arcane Signet', 'Orzhov Signet', 'Mind Stone', 'Talisman of Hierarchy', "Commander's Sphere",
  // creatures (22)
  'Viscera Seer', 'Carrion Feeder', 'Vampire of the Dire Moon', 'Indulgent Aristocrat', 'Gifted Aetherborn', 'Legion Lieutenant', 'Cruel Celebrant', 'Zulaport Cutthroat', 'Blood Artist', 'Kalastria Highborn', 'Elas il-Kor, Sadistic Pilgrim', 'Vampire Nighthawk', 'Ministrant of Obligation', 'Midnight Reaper', 'Falkenrath Noble', 'Pitiless Plunderer', 'Champion of Dusk', 'Butcher of Malakir', 'Requiem Angel', 'Sun Titan', 'Massacre Wurm', 'Bastion Protector',
  // spells (15)
  "Night's Whisper", 'Sign in Blood', 'Swords to Plowshares', 'Path to Exile', 'Go for the Throat', 'Mortify', 'Anguished Unmaking', 'Vindicate', 'Utter End', 'Damnation', 'Unbreakable Formation', 'Make a Stand', 'Bastion of Remembrance', 'Phyrexian Arena', 'Skullclamp',
];
const ELENDA_BOT_UPGRADES = ['Teysa Karlov', 'Bitterblossom', 'Sanguine Bond', 'Dark Prophecy', 'Smothering Tithe', "Teferi's Protection", 'Flawless Maneuver', 'Toxic Deluge', 'Infernal Grasp', 'Demonic Tutor', 'Vampiric Tutor', 'Swiftfoot Boots', 'Darksteel Plate', 'Lightning Greaves', 'Ghostly Prison', 'Secure the Wastes', 'Despark', "Wayfarer's Bauble", 'Morbid Opportunist', 'Ophiomancer'];


/* Revival Trance (FINAL FANTASY VI) and Wakanda Forever: official lists from MTGJSON (Wizards' decklist pages) */
const RT_PRECON = [["Angel of the Ruins", 1], ["Anger", 1], ["Arcane Signet", 1], ["Archfiend of Depravity", 1], ["Ash Barrens", 1], ["Banon, the Returners' Leader", 1], ["Battlefield Forge", 1], ["Bedevil", 1], ["Big Score", 1], ["Celes, Rune Knight", 1], ["Clifftop Retreat", 1], ["Coin of Fate", 1], ["Combustible Gearhulk", 1], ["Command Tower", 1], ["Commander's Sphere", 1], ["Crackling Doom", 1], ["Cyan, Vengeful Samurai", 1], ["Demolition Field", 1], ["Desolate Mire", 1], ["Dragonskull Summit", 1], ["Edgar, Master Machinist", 1], ["Espers to Magicite", 1], ["Evolving Wilds", 1], ["Exotic Orchard", 1], ["Fetid Heath", 1], ["Flayer of the Hatebound", 1], ["Foreboding Ruins", 1], ["Furycalm Snarl", 1], ["Gau, Feral Youth", 1], ["General Leo Cristophe", 1], ["Geothermal Bog", 1], ["Gogo, Mysterious Mime", 1], ["Graven Cairns", 1], ["High Market", 1], ["Interceptor, Shadow's Hound", 1], ["Isolated Chapel", 1], ["Kefka, Dancing Mad", 1], ["Key to the City", 1], ["Laughing Mad", 1], ["Legions to Ashes", 1], ["Locke, Treasure Hunter", 1], ["Meteor Golem", 1], ["Millikin", 1], ["Mind Stone", 1], ["Mog, Moogle Warrior", 1], ["Morbid Opportunist", 1], ["Mortify", 1], ["Mountain", 3], ["Night's Whisper", 1], ["Nomad Outpost", 1], ["Palace Jailer", 1], ["Path of Ancestry", 1], ["Phoenix Down", 1], ["Pitiless Plunderer", 1], ["Plains", 4], ["Priest of Fell Rites", 1], ["Reanimate", 1], ["Rejoin the Fight", 1], ["Rise of the Dark Realms", 1], ["Rogue's Passage", 1], ["Rugged Prairie", 1], ["Ruin Grinder", 1], ["Ruinous Ultimatum", 1], ["Sabin, Master Monk", 1], ["Sacred Peaks", 1], ["Sepulchral Primordial", 1], ["Setzer, Wandering Gambler", 1], ["Shadow, Mysterious Assassin", 1], ["Shadowblood Ridge", 1], ["Shineshadow Snarl", 1], ["Siegfried, Famed Swordsman", 1], ["Smoldering Marsh", 1], ["Snort", 1], ["Sol Ring", 1], ["Solemn Simulacrum", 1], ["Stitch Together", 1], ["Stitcher's Supplier", 1], ["Strago and Relm", 1], ["Sulfurous Springs", 1], ["Summon: Esper Valigarmanda", 1], ["Sun Titan", 1], ["Sunlit Marsh", 1], ["Sunscorched Divide", 1], ["Swamp", 3], ["Swiftfoot Boots", 1], ["Talisman of Conviction", 1], ["Talisman of Indulgence", 1], ["The Falcon, Airship Restored", 1], ["The Warring Triad", 1], ["Tragic Arrogance", 1], ["Umaro, Raging Yeti", 1], ["Wayfarer's Bauble", 1]];
const RT_CUT = ['Gogo, Mysterious Mime', 'Strago and Relm', 'Summon: Esper Valigarmanda', 'Mog, Moogle Warrior', 'Setzer, Wandering Gambler', 'Kefka, Dancing Mad', 'Locke, Treasure Hunter', "Banon, the Returners' Leader", 'Edgar, Master Machinist', 'Gau, Feral Youth', 'Coin of Fate', 'Rejoin the Fight', 'Espers to Magicite', 'Tragic Arrogance', 'Key to the City', 'Millikin', 'The Warring Triad', 'Big Score', 'Laughing Mad', 'Snort'];
const RT_UPGRADES = ['Entomb', 'Buried Alive', 'Exhume', 'Persist', 'Victimize', 'Living Death', 'Unburial Rites', 'Sheoldred, Whispering One', 'Archon of Cruelty', 'Deadly Rollick', 'Teysa Karlov', 'Blood Artist', 'Smothering Tithe', 'Swords to Plowshares', 'Anguished Unmaking', 'Vindicate', 'Toxic Deluge', "Teferi's Protection", 'Lightning Greaves', 'Phyrexian Arena'];
const WK_PRECON = [["Ancestral Communion", 1], ["Arcane Signet", 1], ["Bast, Panther Goddess", 1], ["Beast Within", 1], ["Birds of Paradise", 1], ["Bountiful Promenade", 1], ["Canopy Vista", 1], ["Command Tower", 1], ["Conduit of Worlds", 1], ["Coveted Jewel", 1], ["Dispatch", 1], ["Divine Visitation", 1], ["Dora Milaje Elite", 1], ["Everett K. Ross, Hapless Attaché", 1], ["Evolving Wilds", 1], ["Fight for the Throne", 1], ["Fleecemane Lion", 1], ["Forest", 12], ["Fortified Village", 1], ["Generous Gift", 1], ["Gilded Lotus", 1], ["Greater Good", 1], ["Hammer of Nazahn", 1], ["Harmonize", 1], ["Hatut Zeraze Strike Force", 1], ["Heart-Shaped Herb", 1], ["Helm of the Host", 1], ["Ingenious Smith", 1], ["Kimoyo Beads", 1], ["King Solomon's Frogs", 1], ["Loyal Guardian", 1], ["Loyal Retainers", 1], ["M'Baku, Jabari Chieftain", 1], ["Martial Coup", 1], ["Metalwork Colossus", 1], ["Meteor Golem", 1], ["Midnight Angel Armor", 1], ["Mind's Eye", 1], ["N'Yami-Class Mother Ship", 1], ["Nakia, Wakandan Operative", 1], ["Nature's Lore", 1], ["Okoye, Mighty and Adored", 1], ["Overwhelming Stampede", 1], ["Palace Jailer", 1], ["Panther Habit", 1], ["Panther Robot", 1], ["Path of Ancestry", 1], ["Plains", 12], ["Queen Mother Ramonda", 1], ["Razorverge Thicket", 1], ["Royal Talon Fighter Jet", 1], ["Scattered Groves", 1], ["Scavenger Grounds", 1], ["Scourglass", 1], ["Shuri's Fabricator", 1], ["Shuri, the Black Panther", 1], ["Sol Ring", 1], ["Solemn Simulacrum", 1], ["Storm, Queen of Wakanda", 1], ["Sungrass Prairie", 1], ["Sunpetal Grove", 1], ["Sword of the Animist", 1], ["T'Chaka, Venerable King", 1], ["Terramorphic Expanse", 1], ["The Great Mound", 1], ["The Spear of Bashenga", 1], ["Thran Dynamo", 1], ["Throne of the High City", 1], ["Trading Post", 1], ["Valorous Stance", 1], ["Vanquish the Horde", 1], ["Vibranium Mining Mech", 1], ["Vibranium Strike Gauntlets", 1], ["W'Kabi, Shield of the Nation", 1], ["Wakanda Forever!", 1], ["Whispersilk Cloak", 1], ["Zuri, Warrior of Wakanda", 1]];
const WK_CUT = ['Conduit of Worlds', 'Greater Good', 'Trading Post', 'Scourglass', 'Heart-Shaped Herb', 'Panther Habit', 'Hatut Zeraze Strike Force', 'Ancestral Communion', 'Coveted Jewel', 'Helm of the Host', 'Metalwork Colossus', 'Loyal Retainers', 'Divine Visitation', "Mind's Eye", 'Fight for the Throne', 'Kimoyo Beads', 'Ingenious Smith', 'Dispatch', "King Solomon's Frogs", 'Everett K. Ross, Hapless Attaché'];
const WK_UPGRADES = ['Swords to Plowshares', 'Path to Exile', 'Smothering Tithe', "Teferi's Protection", 'Heroic Intervention', 'Three Visits', 'Farseek', "Kodama's Reach", 'Cultivate', 'Skullclamp', 'Lightning Greaves', 'Swiftfoot Boots', 'Darksteel Plate', 'Sword of Feast and Famine', 'Sword of Fire and Ice', "Akroma's Will", 'Austere Command', 'Puresteel Paladin', 'Stoneforge Mystic', 'Mind Stone'];
const upgraded = (precon, cut, ups) => [...precon.filter(([n]) => !cut.includes(n)), ...ones(ups)];

const DECKS = {
  shay: { name: 'Shay Cormac (your deck)', commander: 'Shay Cormac', list: SHAY_LIST },
  elenda: {
    name: 'Elenda build (your deck)', commander: 'Elenda, the Dusk Rose',
    list: [...SHAY_LIST.filter(([n]) => !ELENDA_CUT.includes(n)), ...ones(ELENDA_ADD)],
    cut: ELENDA_CUT,
  },
  elendaBot: {
    name: 'Dusk Rose aristocrats (Elenda)', short: 'Elenda', botName: 'Bot', commander: 'Elenda, the Dusk Rose',
    list: [...ones(ELENDA_BOT_BASE), ...ones(ELENDA_BOT_UPGRADES), ...ones(['Command Tower', 'Scoured Barrens', 'Orzhov Basilica']), ['Plains', 16], ['Swamp', 17]],
    upgrades: ELENDA_BOT_UPGRADES,
  },
  revival: {
    name: 'Revival Trance (FINAL FANTASY VI) + 20 upgrades', short: 'Terra', botName: 'Bot', commander: "Terra, Herald of Hope",
    list: upgraded(RT_PRECON, RT_CUT, RT_UPGRADES), cut: RT_CUT, upgrades: RT_UPGRADES,
  },
  wakanda: {
    name: 'Wakanda Forever + 20 upgrades', short: "T'Challa", botName: 'Bot', commander: "T'Challa, the Black Panther",
    list: upgraded(WK_PRECON, WK_CUT, WK_UPGRADES), cut: WK_CUT, upgrades: WK_UPGRADES,
  },
  cloud: {
    name: 'Limit Break (Cloud)', short: 'Cloud', botName: 'Bot', commander: 'Cloud, Ex-SOLDIER',
    list: [...ones(CLOUD_PRECON_CREATURES.filter(n => !CLOUD_CUT.includes(n))), ...ones(CLOUD_PRECON_OTHER), ...ones(CLOUD_UPGRADES), ['Mountain', 12], ['Forest', 12], ['Plains', 12]],
    cut: CLOUD_CUT,
  },
  sai: {
    name: 'Keen Engineering (Sai)', short: 'Sai', botName: 'Bot', commander: 'Sai, Master Thopterist',
    list: [...ones(SAI_PRECON_CREATURES.filter(n => !SAI_CUT.includes(n))), ...ones(SAI_PRECON_OTHER), ...ones(SAI_UPGRADES), ['Island', 38]],
    cut: SAI_CUT,
  },
};
function deckCount(key) { return DECKS[key].list.reduce((a, [, n]) => a + n, 0); }
