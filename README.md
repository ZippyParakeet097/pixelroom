# pixelroom

My portfolio, dressed up like one of those retro RPGs.

It opens on a mahogany door with my name on it, standing ajar, with a storm
going on somewhere behind it. Open that and you walk through it into a
low-poly bedroom running under a chunky pixel-art filter.
Click something and the camera walks across the room to it. Takes a beat, but
that's half the fun. Most of the furniture does something. The PC boots a
fake Windows XP desktop, skinned with [XP.css](https://botoxparty.github.io/XP.css/),
with a terminal, my résumé, and two games you can actually play.

The jukebox is the part I'm proudest of. It's got a couple of tunes I really
like, and I sank way more time than was strictly necessary into building a
little record-changing mechanism you can watch working through the "glass".
AI helped a lot with that one. Worth it.

Elsewhere: a bookshelf of projects, a corkboard of random facts, a window
with a neat little rain effect, and a whiteboard you can mess around with. The lava lamp is
there because I genuinely couldn't think of anything else to put in that
corner, and it sells that retro 2000s vibe anyway. Lava lamps and those tacky
fake aquariums were peak decor back then.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Desktop only. Honestly I just couldn't be arsed to work out how to port this
to small screens, and I reckon it feels more authentic on a big viewport
regardless. I am putting together a plain, actual portfolio site for phones
instead of trying to squeeze the gamified one down.

## Navigation

- Click a hotspot to zoom in, `Esc` to back out
- `M` mutes everything
- Terminal: `help` for the list, arrows for history, `Tab` autocompletes
- Snake: arrows or WASD
- Contra: `←`/`→` move, `Z` jump, `X` shoot, `↑` aim
