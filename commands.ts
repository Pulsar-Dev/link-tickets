import { ApplicationCommand, Collection } from "./deps.ts";

export async function get_commands(): Promise<
  Collection<string, ApplicationCommand[]>
> {
  const commands: Collection<string, ApplicationCommand[]> = new Collection<
    string,
    []
  >();

  const command_files = Deno.readDir("./commands");

  for await (const file of command_files) {
    if (file.isFile && file.name.endsWith(".ts")) {
      const command = await import(`./commands/${file.name}`);
      commands.set(file.name.replace(".ts", ""), command.commands);
    }
  }

  return commands;
}
