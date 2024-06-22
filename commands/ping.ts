import { Interaction } from "https://deno.land/x/harmony@v2.9.1/src/structures/interactions.ts";
import { mod } from "../mod.ts";

export default {
  name: "ping",
  description: "Ping the bot.",
  options: [],
  execute: function (interaction: Interaction) {
    const ping = mod;
    interaction.respond({
      content: "Pong!",
    })
  },
};
