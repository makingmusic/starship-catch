# How big the catch was

A static page for the first catch of a Starship upper stage. On 14 November 2026 the tower at Starbase caught Ship 42, which had launched the afternoon before, spent 22 hours and 33 minutes in orbit, and come back through re-entry. The landing burn lasted 18 seconds. The ship was uncrewed.

The page is [https://makingmusic.github.io/starship-catch/](https://makingmusic.github.io/starship-catch/).

Open `index.html` in a browser, or run `python3 serve.py` from this folder. There is no build step. Use a trailing slash on the public address so the pictures resolve.

`index.html` is the walkthrough. A sideways row sets the ship beside familiar things at one scale. That row scrolls sideways only. Buttons jump to an object, or change how much height fits in the frame. A zoom keeps a person at the height typed in the header while the rocket changes size. The 9 metre width, the 33 engines, the heat-shield tiles, and a walk up the tower follow. The eighteen-second player then runs the landing burn in real time. The diverter sketch shows the steel plate under the booster, the water rising into the bells, and the engines lighting. The last section is the photographs and clips.

`inside.html` is the cabin study: the published volume, a 747 for comparison, and a zoom from the whole ship down to one seat and the heat-shield wall. It says which parts are published and which are a sketch.

## Pictures and drawings

The photographs and video are the originals posted by [SpaceX](https://x.com/SpaceX) and [Elon Musk](https://x.com/elonmusk) on X. They stay in `media/` so the page does not depend on those URLs remaining hot. The pictures remain theirs. Each one on the page links to the post.

`media/approach-frames/` holds 37 stills taken in order from `media/approach.mp4`, SpaceX’s clip of Ship 42 coming in to be caught. The eighteen-second player steps through those frames while the clock runs for 18 seconds and is not sped up. The clip itself is about half a minute, so a frame is not a measured instant of the burn. The five captions on that player are the timeline. The frames are the filmed order.

The person drawn next to the vehicle is an illustration in `media/figure-sheet.jpg`, scaled to the height typed in the header. The field accepts 100 to 220 cm and remembers the value in this browser under `starship-catch-height-cm`. That figure is not a photograph and not someone who flew. The familiar objects in `media/world/` are illustrations too. Each one is scaled to one real length. They are not photographs, and they are not part of the catch gallery.

The tile model can be turned. Its colors are a diagram. The shield in the photographs is black. The diverter picture is a sketch drawn by the page. Seven bells stand in for the 33, at the published Raptor size of 1.3 m across and 2.9 m tall. The plate is drawn thick so the holes stay visible. Plate thickness and hole count are not measured there. The shake slider moves the liftoff photograph as a picture of energy falling with distance. It is not a seismometer record.

## Numbers

Dimensions for the vehicle and the engines are the ones printed on [SpaceX’s Starship page](https://www.spacex.com/vehicles/starship/). The tower height, the tile width, the arm position, and the shake slider are marked on the page as reported, measured by others, or drawn as a sketch. The page says which is which. The sources section at the bottom of `index.html` is that list.

## Files

- `index.html`, `inside.html` — the two pages.
- `look.js`, `app.js`, `tile3d.js`, `inside.js`, `styles.css` — the pages. No framework. `index.html` loads `look.js`, then `app.js`, then `tile3d.js`. `inside.html` loads `look.js` and `inside.js`.
- `serve.py` — the local server on port 8911.
- `media/` — the SpaceX and Elon Musk photographs and clips, the 37 approach frames, the person sheet, and the comparison illustrations in `media/world/`.
