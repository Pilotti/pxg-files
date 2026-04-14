import { useEffect, useMemo, useRef, useState } from "react"

export default function AppSelect({
  value,
  options = [],
  onChange,
  placeholder = "",
  ariaLabel,
  className = "",
  disabled = false,
  id,
}) {
  const rootRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const normalizedOptions = useMemo(() => (
    options.filter((option) => option && option.value !== undefined)
  ), [options])

  const selectedIndex = normalizedOptions.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(Math.max(0, selectedIndex))
    }
  }, [isOpen, selectedIndex])

  function commitOption(option) {
    if (disabled) return
    onChange?.(option.value)
    setIsOpen(false)
  }

  function handleButtonKeyDown(event) {
    if (disabled) return

    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      return
    }

    event.preventDefault()

    if (!isOpen) {
      setIsOpen(true)
      return
    }

    if (event.key === "ArrowDown") {
      setActiveIndex((current) => Math.min(normalizedOptions.length - 1, current + 1))
      return
    }

    if (event.key === "ArrowUp") {
      setActiveIndex((current) => Math.max(0, current - 1))
      return
    }

    const option = normalizedOptions[activeIndex]
    if (option) {
      commitOption(option)
    }
  }

  return (
    <div ref={rootRef} className={["app-select", isOpen ? "app-select--open" : "", disabled ? "app-select--disabled" : "", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        id={id}
        className="app-select__button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
      >
        <span className={selectedOption ? "app-select__value" : "app-select__value app-select__value--placeholder"}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="app-select__chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="app-select__menu" role="listbox" tabIndex={-1}>
          {normalizedOptions.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={[
                  "app-select__option",
                  isSelected ? "app-select__option--selected" : "",
                  isActive ? "app-select__option--active" : "",
                ].filter(Boolean).join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitOption(option)}
              >
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

