import { UserRound } from 'lucide-react';

function UserProfile({ user }) {
  const name = user?.nombre?.trim() || 'Usuario';
  const initial = name.charAt(0).toUpperCase();
  const role = user?.rol?.trim() || 'Sin rol asignado';
  const site = user?.sede?.trim();

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dcebdc] text-sm font-bold text-[#173d26]" aria-hidden="true">
        {initial || <UserRound className="size-4" />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{name}</p>
        <p className="truncate text-xs text-[#b9d0bd]">
          {role}{site ? ` · ${site}` : ''}
        </p>
      </div>
    </div>
  );
}

export default UserProfile;
