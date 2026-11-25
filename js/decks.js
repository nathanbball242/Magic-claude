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

const DECKS = {
  shay: { name: 'Shay Cormac (your deck)', commander: 'Shay Cormac', list: SHAY_LIST },
  elenda: {
    name: 'Elenda build (your deck)', commander: 'Elenda, the Dusk Rose',
    list: [...SHAY_LIST.filter(([n]) => !ELENDA_CUT.includes(n)), ...ones(ELENDA_ADD)],
    cut: ELENDA_CUT,
  },
  elendaBot: {
    name: 'Dusk Rose aristocrats (Elenda)', botName: 'Bot', commander: 'Elenda, the Dusk Rose',
    list: [...ones(ELENDA_BOT_BASE), ...ones(ELENDA_BOT_UPGRADES), ...ones(['Command Tower', 'Scoured Barrens', 'Orzhov Basilica']), ['Plains', 16], ['Swamp', 17]],
    upgrades: ELENDA_BOT_UPGRADES,
  },
  cloud: {
    name: 'Limit Break (Cloud)', botName: 'Bot', commander: 'Cloud, Ex-SOLDIER',
    list: [...ones(CLOUD_PRECON_CREATURES.filter(n => !CLOUD_CUT.includes(n))), ...ones(CLOUD_PRECON_OTHER), ...ones(CLOUD_UPGRADES), ['Mountain', 12], ['Forest', 12], ['Plains', 12]],
    cut: CLOUD_CUT,
  },
  sai: {
    name: 'Keen Engineering (Sai)', botName: 'Bot', commander: 'Sai, Master Thopterist',
    list: [...ones(SAI_PRECON_CREATURES.filter(n => !SAI_CUT.includes(n))), ...ones(SAI_PRECON_OTHER), ...ones(SAI_UPGRADES), ['Island', 38]],
    cut: SAI_CUT,
  },
};
function deckCount(key) { return DECKS[key].list.reduce((a, [, n]) => a + n, 0); }
