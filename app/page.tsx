import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex gap-4">
        <Link
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          href="/preview"
        >
          Visit Preview
        </Link>
        <a
          href="https://cursor.com/en-US/install-mcp?name=ai-wiki&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vYWktd2lraS1udS52ZXJjZWwuYXBwL2FwaS9tY3AifQ%3D%3D"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center"
        >
          <Image
            src="https://cursor.com/deeplink/mcp-install-dark.svg"
            alt="Install MCP Server"
            width={200}
            height={48}
            className="dark:hidden"
          />
        </a>
      </div>
    </div>
  );
}
