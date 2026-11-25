# Shay Cormac Duel

Mobile-first, single-page Commander game: your deck 1v1 against a bot. You pick Shay Cormac or the Elenda swap of the same deck; the bot plays Cloud (Limit Break + 20 upgrades), Sai (Keen Engineering + 20 upgrades) or Dusk Rose (Elenda aristocrats + 20 upgrades). 40 life, 21 commander damage.

Open `index.html` in a browser (no build step, no server needed). Card art loads from Scryfall when the network allows it; otherwise cards render as text tiles with full Oracle text.

## How to play
- Your hand is along the bottom, battlefields stacked above it, bot on top.
- Tap any card to see it full size with its Oracle text and every action you can take with it right now (cast, play land, activate, equip, foretell).
- Targeting: tap the glowing card. Attacking: tap creatures to toggle, then Attack. Blocking: tap your creature, then the attacker.
- Mana is colored. Costs show real symbols, and your mana chip shows how many of each color you can make. Payment is automatic and picks the tapping that keeps your flexible sources (Scoured Barrens, Talisman, Treasures) open when a basic will do. Hybrid {W/B}, {C}, Orzhov Basilica's {W}{B}, Arcane Signet's commander colors, Forsaken Monument, Urza, improvise and convoke are all handled.
- You get a response window when the bot casts removal or a wipe, targets your stuff, at its beginning of combat, when it attacks, after blocks and at its end step. Turn on "respond to every bot spell" in the menu for more.
- Bounty counters show as a gold skull badge. Shay's `{1}` strip ability lives on Shay's card.
- Shay's `{1}` ability follows the printed card by default: it strips protection, and bounty counters come only from targeting. A start-screen and menu switch turns on the house rule where `{1}` also puts a bounty counter on every bot creature. The game asks before you cast a wipe that would kill an unprotected Shay.

## Bot rules (from the sims)
Commander first when affordable, then cheapest spells first. Holds protection and counterspells for your removal and wipes. Removal hits your commander or a creature with power 3+. Wipes only when your power is at least 2x theirs + 8 and at least 10. Won't attack into more deathtouch blockers than attackers unless evasive. Pays Ghostly Prison tax only with spare mana. Cloud equips everything onto Cloud.

## Decks
`js/decks.js`. Bot decks are precon + 20 upgrades, with the weakest original precon creatures cut to reach exactly 99 + commander (14 cut from Cloud, 18 from Sai; the cut list is shown on the start screen).

## Your Elenda build
Same 99 as the Shay deck with Elenda, the Dusk Rose as commander. Cut: Gideon's Lawkeeper, Goldmeadow Harrier, Blinding Mage, Sorceress Queen. Added: Shay Cormac (in the 99), Viscera Seer, Zulaport Cutthroat, Cruel Celebrant.

## Dusk Rose bot deck
No official precon is led by Elenda, the Dusk Rose, so this is a W/B vampire aristocrats list built precon style (43 base cards) plus 20 upgrades (marked on the start screen) and 36 lands. The bot sacrifices creatures to Viscera Seer, Carrion Feeder or Indulgent Aristocrat in response to your removal when it has no protection spell.

## Code
- `js/engine.js` rules engine (stack, priority windows, combat with first strike/trample/deathtouch/menace/etc, state-based actions, commander tax and damage)
- `js/cards-*.js` card scripts written from Oracle text
- `js/ai.js` bot
- `js/ui.js`, `js/main.js`, `css/style.css` interface
- `tools/sim.js` headless bot-vs-bot batch test: `node tools/sim.js 50 both`
- `tools/ui-smoke.js`, `tools/ui-flow.js` Playwright browser tests
- `tools/build-artifact.js` one-file build
- The bot plays the land and fetches the basic its hand needs most by color.

## Simplifications
Venture always walks Lost Mine of Phandelver (Cave Entrance, Goblin Lair, Dark Pool, Temple). Misleading Signpost's reselect does nothing in 1v1. Ichormoon Gauntlet's planeswalker text is unused (no planeswalkers). Arcane Denial's draws are automatic. Triggered abilities without targets resolve immediately; targeted ones use the stack so you can respond.
