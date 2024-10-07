
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { signInAction } from "@/app/actions";
import Image from "next/image";

export default async function Index({ searchParams }: { searchParams: Message }) {
  return (
    <>
      <main className="flex-1 flex flex-col">
        <div className="flex justify-end">
          <Image src="/platform_ai.jpeg" 
            alt="background image" 
            layout="fill"
            objectFit="cover"
            quality={100}
          />
          <div className="w-96 p-4 bg-gray-400 rounded-md bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-10 shadow-md border border-foreground/10">
          <form className="flex-1 flex flex-col min-w-64">
            <h1 className="text-2xl font-medium">Sign in</h1>
            <p className="text-sm text-foreground">
              Don't have an account?{" "}
              <Link className="text-foreground font-medium underline" href="/sign-up">
                Sign up
              </Link>
            </p>
            <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
              <Label htmlFor="email">Email</Label>
              <Input name="email" placeholder="you@example.com" required />
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  className="text-xs text-foreground underline"
                  href="/forgot-password"
                >
                  Forgot Password?
                </Link>
              </div>
              <Input
                type="password"
                name="password"
                placeholder="Your password"
                required
              />
              <Input
                type="hidden"
                name="errorRedirect"
                value="/"
              />
              <SubmitButton pendingText="Signing In..." formAction={signInAction}>
                Sign in
              </SubmitButton>
              <FormMessage message={searchParams} />
            </div>
          </form>
          </div>
        </div>
      </main>
    </>
  );
}
