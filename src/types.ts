type Match = {
    id: string;
    score: number;
    values: number[];
    sparseValues: {
      indices: number[];
      values: number[];
    };
    metadata: {
      [key: string]: any;
    };
  };
  
type MatchesResponse = {
matches: Match[];
namespace: string;
};