import { Button } from '@/components/ui/button';
// import { auth, signOut } from '@/lib/auth';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { signOutAction } from '@/app/actions';
import { createClient } from "@/utils/supabase/server";

export async function User() {
  const {
    data: { user },
  } = await createClient().auth.getUser();

  return (
    <div className="flex items-center gap-2">
      Hey, {user?.email}!
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="overflow-hidden rounded-full"
        >
          {/* <Image
            src={user?.image ?? '/placeholder-user.jpg'}
            width={36}
            height={36}
            alt="Avatar"
            className="overflow-hidden rounded-full"
          /> */}
          <Image
            src={'/placeholder-user.jpg'}
            width={36}
            height={36}
            alt="Avatar"
            className="overflow-hidden rounded-full"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href={`/dashboard/user`} className='w-full' >
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href={`/dashboard/system-updates`} className='w-full' >
            System Updates
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user ? (
          <DropdownMenuItem>
            <form action={signOutAction}>
              <button type="submit">Sign Out</button>
            </form>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem>
            <Link href="/login">Sign In</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}