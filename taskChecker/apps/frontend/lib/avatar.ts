/** Per-user avatar hue (audit Part 4): a small hash of the user id mapped to a
 * hue, so people are recognizable at a glance without reading the name.
 * Pair with `.tf-avatar` in tokens.css:
 *   <span className="tf-avatar" style={{ "--avatar-hue": avatarHue(user.id) }}>… */
export function avatarHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
