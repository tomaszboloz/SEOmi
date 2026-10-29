Właściciel zgłosił w rozmowie potrzebę pełnej listy fraz w panelu „Szanse w GSC”, paginacji, sortowania i filtrowania po samodzielnie wpisanym fragmencie tekstu.

Obecny `GscOpportunities.tsx` renderuje tylko pierwsze 20 fraz z każdej grupy, bez nawigacji ani filtra. Obie funkcje analityczne zwracają pełne grupy; limit jest w UI. Dodanie pełnego widoku wymaga również uniknięcia ponawiania kosztownego obliczania benchmarków podczas wpisywania filtra.

Kryteria odbioru:

- Widok wszystkich fraz dostępnych w aktualnym snapshotcie, z zachowaniem widoków 10–20 i niskiego CTR.
- Brak ukrytego obcięcia do 20 wyników; wszystkie pasujące wiersze są dostępne przez paginację.
- Rozmiary strony, licznik wyników, poprzednia/następna i poprawne granice/reset po zmianie danych lub filtra.
- Sortowanie po frazie i obserwowanych metrykach, dostępne z klawiatury i opisane przez ARIA.
- Filtr „zawiera tekst”: użytkownik wpisuje dowolny dosłowny ciąg, bez rozróżniania wielkości liter; metaznaki nie są wyrażeniem regularnym.
- Reset/czyszczenie filtra przywraca pełny dostęp do aktualnych danych; brak wyników ma osobny czytelny stan.
- Pozostają ostrzeżenia o limitach GSC, definicja średniej pozycji i porównania CTR oraz informacja o niewydzielaniu AI Overviews. Nie deklarujemy dostępu do wierszy, których Google nie zwrócił.
- Benchmark CTR zachowuje dokładną politykę porównania; obsługa dużych zbiorów nie blokuje filtrowania.
- Testy >20 wierszy, kolejnych stron, sortowania, Unicode i dosłownych metaznaków, zmiany snapshotu, pustych wyników; 12 lokalizacji, MAX150 i bramki pokrycia bez zmian.

Implementacja w toku, powiązana z integracją #221. Nie dołączamy danych ani fraz z prywatnego raportu użytkownika do publicznego zgłoszenia.
