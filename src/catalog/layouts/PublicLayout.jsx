export default function PublicLayout({ children }) {
  return (
    <div data-app-layout="public" data-app-surface="public">
      {children}
    </div>
  );
}
