import Image from "next/image";
import { cn } from "@/lib/utils";

type AvatarProps = {
  alt: string;
  className?: string;
  fallback: string;
  size?: number;
  src?: string | null;
};

function Avatar({ alt, className, fallback, size = 40, src }: AvatarProps) {
  return (
    <span
      className={cn(
        "bg-secondary text-secondary-foreground relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold",
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : (
        <span aria-label={alt}>{fallback}</span>
      )}
    </span>
  );
}

export { Avatar };
