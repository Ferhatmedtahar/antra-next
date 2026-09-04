import { checkbox, confirm, input } from "@inquirer/prompts";

export interface CheckboxChoice<T> {
  name: string;
  value: T;
  checked?: boolean;
}

/**
 * The only surface `runInit` uses to talk to a human. Kept as an interface
 * so tests drive the whole flow with scripted answers and no TTY.
 */
export interface Prompter {
  confirm(message: string, defaultValue: boolean): Promise<boolean>;
  checkbox<T>(
    message: string,
    choices: readonly CheckboxChoice<T>[],
  ): Promise<T[]>;
  input(message: string, defaultValue: string): Promise<string>;
}

export const inquirerPrompter: Prompter = {
  confirm: (message, defaultValue) =>
    confirm({ message, default: defaultValue }),

  checkbox: <T>(message: string, choices: readonly CheckboxChoice<T>[]) =>
    checkbox<T>({
      message,
      choices: choices.map((choice) => ({
        name: choice.name,
        value: choice.value,
        checked: choice.checked ?? false,
      })),
    }),

  input: (message, defaultValue) =>
    input({ message, default: defaultValue || undefined }),
};

/** True when the user hit Ctrl+C inside an inquirer prompt. */
export function isPromptExit(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}
