export interface StatusSetter {
  setStatus: (status: string | JSX.Element, isLoading?: boolean) => void;
}
