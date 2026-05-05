Drop emote image files here (PNG with transparency).

Naming convention:
  bee.png
  star.png
  heart.png
  fire.png
  laugh.png
  party.png

Current emotes use canvas-drawn emoji textures (no files needed).
Swap to image-based sprites by replacing makeEmojiTexture() in src/main.js
with a THREE.TextureLoader().load('assets/emotes/bee.png') call.
