import { PulsarTicketsCommand } from "./command.types.ts";

export async function get_commands() {
  const commands: PulsarTicketsCommand[] = [];

  const command_files = Deno.readDir("./commands");

  for await (const file of command_files) {
    if (file.isFile && file.name.endsWith(".ts")) {
      const command = await import(`./commands/${file.name}`);
      commands.push(command.default);
    }
  }

  return commands;
}
