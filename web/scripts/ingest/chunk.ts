// Cuts a section of prose into overlapping passages of roughly `size` words, ending on sentence boundaries,
// so each retrieved passage reads as a complete thought.
export function chunk(text: string, size = 220, overlap = 40): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+["”’)\]]*|$)\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const passages: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const s of sentences) {
    const n = s.split(" ").length;
    if (words + n > size && current.length) {
      passages.push(current.join(" "));
      // Carry the last few sentences forward as overlap.
      const carry: string[] = [];
      let w = 0;
      for (let i = current.length - 1; i >= 0 && w < overlap; i--) {
        carry.unshift(current[i]);
        w += current[i].split(" ").length;
      }
      current = carry;
      words = w;
    }
    current.push(s);
    words += n;
  }
  if (current.length) passages.push(current.join(" "));
  // A trailing scrap too short to stand alone joins the previous passage.
  if (passages.length > 1 && passages[passages.length - 1].split(" ").length < 40) {
    const last = passages.pop()!;
    passages[passages.length - 1] += " " + last;
  }
  return passages;
}
