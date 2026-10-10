import { useRef, useState } from 'react';
import * as store from '../data/store.js';
import { useStore } from '../hooks/useStore.js';
import { useDraftValue } from '../hooks/useDebounced.js';
import { filterCommunity } from '../utils/filters.js';
import { FilterBar, FilterDialog } from '../components/community/Filters.jsx';
import { SurveyCard } from '../components/survey/SurveyCard.jsx';
import { NoFilterResults, NoSearchResults } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';
import { cardGrid } from './SurveyListPage.jsx';
import { t } from '../i18n/index.js';

export function CommunityPage() {
  const { communitySurveys, communityFilters, communitySearch, starredIds, compareSelection } = useStore();
  const [query, setQuery] = useDraftValue(communitySearch, (value) => store.setCommunitySearch(value));
  const visible = filterCommunity(communitySurveys, communityFilters, starredIds, communitySearch);
  const [filtering, setFiltering] = useState(false);
  const opener = useRef(null);

  return (
    <>
      <PageHead
        title={t('Community surveys')}
        lede={t('Kos recorded by other people. Filter them, star the ones worth keeping, and add any of them to a comparison.')}
      />

      <FilterBar
        query={query}
        onQuery={setQuery}
        filters={communityFilters}
        total={communitySurveys.length}
        showing={visible.length}
        onOpen={() => setFiltering(true)}
        openerRef={opener}
      />

      {visible.length ? (
        <div className={cardGrid}>
          {visible.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              variant="community"
              starred={starredIds.includes(survey.id)}
              inCompare={compareSelection.includes(survey.id)}
              liked={store.isLiked(survey.id)}
              likes={store.likeCount(survey.id)}
            />
          ))}
        </div>
      ) : communitySearch.trim() ? (
        <NoSearchResults
          query={communitySearch}
          onClear={() => {
            store.setCommunitySearch('');
            document.getElementById('community-search')?.focus();
          }}
        />
      ) : (
        <NoFilterResults />
      )}

      <FilterDialog
        open={filtering}
        onClose={() => {
          setFiltering(false);
          opener.current?.focus();
        }}
      />
    </>
  );
}
