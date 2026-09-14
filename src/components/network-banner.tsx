import { useEffect, useState } from "react";

export function NetworkBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="border-b border-flag-yellow/40 bg-flag-yellow/10 px-4 py-2 text-sm text-fg md:ml-56"
    >
      인터넷이 끊겼습니다. 이미 저장한 종목은 볼 수 있고, 시세·공시는 연결되면 다시 불러옵니다.
    </div>
  );
}
