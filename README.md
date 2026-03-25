# AI Diet Adherence — React Native

App React Native (CLI) ispirata al mockup **AI Diet Adherence**: l’utente può seguire dieta e scheda con l’aiuto di un assistente AI per restare aderente al piano.

## Struttura

- **Home**: overview giornata, peso, aderenza, pranzo previsto, shortcut all’assistente
- **La tua dieta**: piano nutrizionale (colazione, pranzo, cena) e alternative
- **Assistente AI**: chat con l’AI (es. “Sono in pizzeria, cosa prendo?”) e motivazioni
- **Progressi**: trend peso, workout/check-in, commento AI, foto progresso

## Requisiti

- Node.js (consigliato >= 22.11)
- Xcode (iOS) e/o Android Studio (Android)
- CocoaPods per iOS: `sudo gem install cocoapods` oppure `bundle install` in `ios/`

## Installazione

```bash
cd DietAdherenceApp
npm install
```

### iOS

```bash
cd ios && bundle exec pod install && cd ..
npm run ios
```

### Android

Avvia un emulatore o collega un dispositivo, poi:

```bash
npm run android
```

## Script

| Comando       | Descrizione        |
|---------------|--------------------|
| `npm start`   | Metro bundler      |
| `npm run ios` | Avvia su iOS       |
| `npm run android` | Avvia su Android |

## Tecnologie

- React Native (CLI)
- React Navigation (bottom tabs)
- TypeScript
- react-native-gesture-handler, react-native-screens
