# Faces

The robot draws its three expressions in code (`faces.py`): they scale to any
screen and can blink and move the mouth while speaking.

To use your own artwork instead, put PNG files here named:

- `happy.png`
- `neutral.png`
- `angry.png`

They are stretched to the screen size, so match your LCD's aspect ratio
(e.g. 480×320). Any expression without a PNG keeps the drawn face.
Custom images are static (no blinking or mouth animation).

Preview the built-in faces: `python faces.py previews/` writes PNGs of each one.
