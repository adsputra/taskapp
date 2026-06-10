export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E1E5F3] border-t-[#0073EA]" />
        <p className="text-sm text-[#676879]">Loading...</p>
      </div>
    </div>
  );
}
