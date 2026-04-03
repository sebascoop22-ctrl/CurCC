/**
 * One-off: download ~1280px Wikimedia Commons thumbnails for fleet heroes.
 * Run: node scripts/download-fleet-images.mjs
 * Licensed CC BY-SA — see public/cars/ATTRIBUTION.txt
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const carsDir = path.join(root, "public", "cars");

const UA = "CooperConciergeFleetImages/1.0 (local build; +https://cooperconcierge.co.uk)";

const jobs = [
  {
    slug: "mercedes-maybach-s-class",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/2023_Mercedes_Maybach_S580_in_Obsidian_Black_and_High-Tech_Silver%2C_front_left_side.jpg/1280px-2023_Mercedes_Maybach_S580_in_Obsidian_Black_and_High-Tech_Silver%2C_front_left_side.jpg",
  },
  {
    slug: "mercedes-s-class",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Mercedes-Benz_S-Klasse_%28W223%29_S_580_e_%282021%29_%2853322695161%29.jpg/1280px-Mercedes-Benz_S-Klasse_%28W223%29_S_580_e_%282021%29_%2853322695161%29.jpg",
  },
  {
    slug: "bmw-i7",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/BMW_G70E_i7_xDrive60_Design_Pure_Excellence_Black_Sapphire_Metallic_%284%29.jpg/1280px-BMW_G70E_i7_xDrive60_Design_Pure_Excellence_Black_Sapphire_Metallic_%284%29.jpg",
  },
  {
    slug: "range-rover-26",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/2022_Land_Rover_Range_Rover_SV_Autobiography.jpg/1280px-2022_Land_Rover_Range_Rover_SV_Autobiography.jpg",
  },
  {
    slug: "range-rover-autobiography",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Land_Rover_Range_Rover_Autobiography_L460_Lantau_Bronze_%282%29.jpg/1280px-Land_Rover_Range_Rover_Autobiography_L460_Lantau_Bronze_%282%29.jpg",
  },
  {
    slug: "rolls-royce-ghost",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Rolls-Royce_Ghost_II_IAA_2021_1X7A0005.jpg/1280px-Rolls-Royce_Ghost_II_IAA_2021_1X7A0005.jpg",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(
        url,
        {
          headers: { "User-Agent": UA, Accept: "image/*" },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.close();
            fs.unlinkSync(dest);
            const loc = res.headers.location;
            if (!loc) {
              reject(new Error("Redirect without location"));
              return;
            }
            download(loc, dest).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            file.close();
            fs.unlinkSync(dest);
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => file.close((e) => (e ? reject(e) : resolve())));
        },
      )
      .on("error", (err) => {
        file.close();
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function main() {
  for (let i = 0; i < jobs.length; i++) {
    const { slug, url } = jobs[i];
    const dir = path.join(carsDir, slug);
    const dest = path.join(dir, "01-hero.jpg");
    if (!fs.existsSync(dir)) {
      console.warn(`skip ${slug}: folder missing`);
      continue;
    }
    process.stdout.write(`${slug} … `);
    try {
      await download(url, dest);
      const st = fs.statSync(dest);
      console.log(`${Math.round(st.size / 1024)} KB`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
    if (i < jobs.length - 1) await sleep(8000);
  }
}

main().catch(console.error);
