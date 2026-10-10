import * as store from '../data/store.js';
import { useStore } from '../hooks/useStore.js';
import { useDraftValue } from '../hooks/useDebounced.js';
import { filterSurveys } from '../utils/filters.js';
import { TextField } from '../components/form/fields.jsx';
import { SurveyCard } from '../components/survey/SurveyCard.jsx';
import { GuestSurveys, NoSearchResults, NoSurveysYet } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';

export const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4';

export function SurveyListPage() {
  const { user } = useStore();
  if (!user) {
    return (
      <>
        <PageHead title="My surveys" lede="The kos you have visited and recorded, kept in your account." />
        <GuestSurveys />
      </>
    );
  }
  return <OwnSurveys />;
}

function OwnSurveys() {
  const { surveys, search, compareSelection } = useStore();
  const [query, setQuery] = useDraftValue(search, (value) => store.setSearch(value));
  const visible = filterSurveys(surveys, search);

  const clearSearch = () => {
    store.setSearch('');
    document.getElementById('survey-search')?.focus();
  };

  let body;
  if (!surveys.length) body = <NoSurveysYet />;
  else if (!visible.length) body = <NoSearchResults query={search} onClear={clearSearch} />;
  else {
    body = (
      <div className={cardGrid}>
        {visible.map((survey) => (
          <SurveyCard key={survey.id} survey={survey} variant="own" inCompare={compareSelection.includes(survey.id)} />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHead
        title="My surveys"
        lede={`${surveys.length} kos recorded${search ? `, ${visible.length} matching` : ''}.`}
      />
      <div className="mb-6 max-w-[420px]">
        <TextField
          name="survey-search"
          id="survey-search"
          label="Search by kos name"
          type="search"
          value={query}
          placeholder="e.g. Melati"
          onChange={setQuery}
        />
      </div>
      {body}
    </>
  );
}
