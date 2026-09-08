# Synthetic attributed-body fixture

`attributed-body.hex` was generated locally with Apple's Foundation framework;
it contains no personal Messages data. Reproduction Swift:

```swift
import Foundation
let value = NSAttributedString(string: "Meet at Olive at 7. 🧠\nBring notes.")
let data = NSArchiver.archivedData(withRootObject: value)
print(data.map { String(format: "%02x", $0) }.joined())
```

The Python test creates a temporary two-row SQLite database using this blob
and a plain-text row, then runs the actual extractor query and uploader.
