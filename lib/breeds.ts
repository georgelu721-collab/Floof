/** URL slug for a breed club, e.g. "Golden Retriever" -> "golden-retriever". */
export const breedSlug = (breed: string) =>
  breed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const breedPackId = (slug: string) => `breed:${slug}`;
