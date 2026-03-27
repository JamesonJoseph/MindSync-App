# Emotion Analysis

Analyze the uploaded face image for an approximate visible emotion.

Return strictly valid JSON with:
- emotion
- confidence
- details

Emotion must be one of:
- happy
- sad
- angry
- surprise
- fear
- disgust
- neutral

If the image is unclear, use `neutral`, confidence `0`, and explain that the image did not provide enough facial detail.
