import NavBar from "@/components/NavBar";

export default function AppLayout({ children }) {
  return (
    <>
      <NavBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </>
  );
}
