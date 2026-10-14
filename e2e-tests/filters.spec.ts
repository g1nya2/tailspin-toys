import { test, expect } from '@playwright/test';

/** Reads each game card's category/publisher id attributes for use in assertions. */
async function readCardFilterIds(
  page: import('@playwright/test').Page,
): Promise<{ id: string; categoryId: string; publisherId: string }[]> {
  return page.getByTestId('game-card').evaluateAll((cards) =>
    cards.map((card) => ({
      id: card.getAttribute('data-game-id') ?? '',
      categoryId: card.getAttribute('data-category-id') ?? '',
      publisherId: card.getAttribute('data-publisher-id') ?? '',
    })),
  );
}

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-filters')).toBeVisible();
  });

  test('filters the game list by a single category', async ({ page }) => {
    const cards = await readCardFilterIds(page);
    const categoryId = cards[0].categoryId;
    const expectedTitles = cards.filter((c) => c.categoryId === categoryId).length;

    await test.step('Select a single category checkbox', async () => {
      await page.getByTestId(`filter-category-${categoryId}`).check();
    });

    await test.step('Verify only games in the selected category are visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(expectedTitles);

      const visibleCategoryIds = await visibleCards.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-category-id')),
      );
      for (const id of visibleCategoryIds) {
        expect(id).toBe(categoryId);
      }
    });

    await test.step('Verify the result count is announced', async () => {
      await expect(page.getByTestId('filter-result-count')).toHaveText(
        `Showing ${expectedTitles} of ${cards.length} games`,
      );
    });
  });

  test('filters the game list by multiple categories with OR semantics', async ({ page }) => {
    const cards = await readCardFilterIds(page);
    const distinctCategoryIds = [...new Set(cards.map((c) => c.categoryId))];
    test.skip(distinctCategoryIds.length < 2, 'Needs at least two categories in the catalog.');

    const [firstCategoryId, secondCategoryId] = distinctCategoryIds;
    const expectedCount = cards.filter(
      (c) => c.categoryId === firstCategoryId || c.categoryId === secondCategoryId,
    ).length;

    await test.step('Select two category checkboxes', async () => {
      await page.getByTestId(`filter-category-${firstCategoryId}`).check();
      await page.getByTestId(`filter-category-${secondCategoryId}`).check();
    });

    await test.step('Verify games from either category are visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(expectedCount);
    });
  });

  test('filters the game list by publisher', async ({ page }) => {
    const cards = await readCardFilterIds(page);
    const publisherId = cards[0].publisherId;
    const expectedCount = cards.filter((c) => c.publisherId === publisherId).length;

    await test.step('Select a publisher checkbox', async () => {
      await page.getByTestId(`filter-publisher-${publisherId}`).check();
    });

    await test.step('Verify only games from the selected publisher are visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(expectedCount);

      const visiblePublisherIds = await visibleCards.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-publisher-id')),
      );
      for (const id of visiblePublisherIds) {
        expect(id).toBe(publisherId);
      }
    });
  });

  test('combines category and publisher filters with AND semantics', async ({ page }) => {
    const cards = await readCardFilterIds(page);
    const categoryId = cards[0].categoryId;
    const publisherId = cards[0].publisherId;
    const expectedCount = cards.filter(
      (c) => c.categoryId === categoryId && c.publisherId === publisherId,
    ).length;

    await test.step('Select a category and a publisher checkbox', async () => {
      await page.getByTestId(`filter-category-${categoryId}`).check();
      await page.getByTestId(`filter-publisher-${publisherId}`).check();
    });

    await test.step('Verify only games matching both filters are visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(expectedCount);
    });
  });

  test('shows an empty state when no games match the combined filters', async ({ page }) => {
    const cards = await readCardFilterIds(page);
    const categoryId = cards[0].categoryId;
    const publisherId = cards[0].publisherId;

    await test.step('Force a filter combination with no matching games', async () => {
      // The seeded catalog may cover every category/publisher combination, so
      // re-tag every card's publisher to guarantee the selected pairing has
      // zero matches — this still exercises the real checkbox interaction
      // and the component's empty-state wiring deterministically.
      await page.locator('[data-testid="game-card"]').evaluateAll((els, excludedPublisherId) => {
        for (const el of els) {
          if (el.getAttribute('data-publisher-id') === excludedPublisherId) {
            el.setAttribute('data-publisher-id', '__none__');
          }
        }
      }, publisherId);
      await page.getByTestId(`filter-category-${categoryId}`).check();
      await page.getByTestId(`filter-publisher-${publisherId}`).check();
    });

    await test.step('Verify the empty state is shown and the grid is hidden', async () => {
      await expect(page.getByTestId('filter-empty-state')).toBeVisible();
      await expect(page.getByTestId('games-grid')).toBeHidden();
      await expect(page.getByTestId('filter-result-count')).toHaveText(`Showing 0 of ${cards.length} games`);
    });
  });

  test('clears all selected filters and restores the full game list', async ({ page }) => {
    const cards = await readCardFilterIds(page);
    const categoryId = cards[0].categoryId;

    await test.step('Select a filter so the list is narrowed', async () => {
      await page.getByTestId(`filter-category-${categoryId}`).check();
      await expect(page.locator('[data-testid="game-card"]:visible')).not.toHaveCount(cards.length);
    });

    await test.step('Click Clear filters', async () => {
      await page.getByTestId('filter-clear').click();
    });

    await test.step('Verify every game is visible again', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(cards.length);
      await expect(page.getByTestId('filter-result-count')).toHaveText(`Showing all ${cards.length} games`);
      await expect(page.getByTestId(`filter-category-${categoryId}`)).not.toBeChecked();
    });
  });

  test('filter checkboxes are keyboard operable with visible focus', async ({ page }) => {
    const firstCheckbox = page.getByTestId('game-filters').getByRole('checkbox').first();

    await test.step('Tab through the page until the first filter checkbox is reached', async () => {
      // Real Tab presses exercise the actual tab order, unlike a programmatic .focus() call.
      const maxTabs = 25;
      for (let i = 0; i < maxTabs; i++) {
        if (await firstCheckbox.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press('Tab');
      }
      await expect(firstCheckbox).toBeFocused();
    });

    await test.step('Verify a visible focus indicator is rendered', async () => {
      const hasVisibleFocusIndicator = await firstCheckbox.evaluate((el) => {
        const style = getComputedStyle(el);
        return style.boxShadow !== 'none' || style.outlineStyle !== 'none';
      });
      expect(hasVisibleFocusIndicator).toBe(true);
    });

    await test.step('Toggle the checkbox with the keyboard', async () => {
      await page.keyboard.press('Space');
      await expect(firstCheckbox).toBeChecked();
    });
  });
});
